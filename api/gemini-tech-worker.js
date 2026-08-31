/**
 * Cloudflare Worker — FREE Gemini Vision for tech passport reading.
 *
 * Deploy separately; set in verify.html:
 *   <meta name="tech-gemini-api" content="https://your-worker.workers.dev/tech">
 *
 * Environment variables:
 *   GEMINI_API_KEY  — from https://aistudio.google.com/apikey (Free Tier)
 *   GEMINI_MODEL    — optional, default gemini-3.6-flash (free tier)
 *
 * Tasks:
 *   extract_vin    — read VIN from field E only
 *   verify_vin     — re-check candidate VIN(s) against the image
 *   extract_tech   — VIN + other vehicle fields from the image
 */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.method !== 'POST') {
      return cors(json({ error: 'method_not_allowed' }, 405));
    }
    try {
      const body = await request.json();
      const apiKey = (body.geminiKey || env.GEMINI_API_KEY || '').trim();
      if (!apiKey) {
        return cors(json({ error: 'config', message: 'GEMINI_API_KEY not configured' }, 503));
      }

      const image = body.image || '';
      if (!image.startsWith('data:image/')) {
        return cors(json({ error: 'image_required' }, 400));
      }

      const task = body.task || 'extract_vin';
      const models = [
        env.GEMINI_MODEL,
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest'
      ].filter((m, i, a) => m && a.indexOf(m) === i);
      const prompt = buildPrompt(task, body);
      const { mime, data } = parseDataUrl(image);

      let lastError = null;
      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime, data } }
              ]
            }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json'
            }
          })
        });

        const raw = await res.json().catch(() => ({}));

        if (res.status === 429) {
          return cors(json({
            error: 'rate_limit',
            message: 'Gemini free tier quota exceeded. Please try again later.'
          }, 429));
        }

        if (!res.ok) {
          const msg = raw?.error?.message || `Gemini API error (${res.status})`;
          if (/quota|rate|limit|resource exhausted/i.test(msg)) {
            return cors(json({ error: 'rate_limit', message: msg }, 429));
          }
          lastError = { error: 'gemini_error', message: msg, status: res.status };
          if (res.status === 404 || /not found|unsupported/i.test(msg)) continue;
          return cors(json({ error: lastError.error, message: lastError.message }, res.status));
        }

        const text = raw?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
        const parsed = parseJsonFromText(text);
        return cors(json(normalizeResponse(parsed, task)));
      }

      if (lastError) {
        return cors(json({ error: lastError.error, message: lastError.message }, lastError.status || 502));
      }
      return cors(json({ error: 'gemini_error', message: 'No Gemini model available' }, 502));
    } catch (e) {
      return cors(json({ error: 'server', message: String(e.message || e) }, 500));
    }
  }
};

const VIN_EXTRACT_RULES = `You are reading a vehicle identification number directly from the image.

Locate the field:
E — Vehicle identification number

Read the VIN directly from the visible characters in the image.
Read every character from left to right.

Do not guess.
Do not infer characters from OCR.
Do not generate a VIN based on probability.
Only return characters that are actually visible in the image.

The VIN should normally contain 17 characters.
Allowed VIN characters: A-H, J-N, P, R-Z, 0-9. No I, O, or Q.

If a character is unclear, inspect the image carefully again before deciding.
If the VIN is genuinely unreadable, return vin as "VIN_NOT_CONFIDENT" and confidence below 0.4.`;

function buildPrompt(task, body) {
  if (task === 'verify_vin') {
    const candidates = [body.vin, body.altVin].filter(Boolean).map((v) => String(v).toUpperCase());
    return [
      VIN_EXTRACT_RULES,
      'Task: VERIFY which candidate VIN (if any) matches what is ACTUALLY PRINTED next to field E.',
      `Candidates: ${candidates.join(' OR ') || 'none'}.`,
      'Compare every character position with the visible image. Do not guess.',
      'Return JSON only:',
      '{"vin":"17_CHAR_VIN_OR_VIN_NOT_CONFIDENT","confidence":0.0}'
    ].join('\n');
  }

  if (task === 'extract_tech') {
    return [
      VIN_EXTRACT_RULES,
      'Task: Read the tech passport / vehicle registration document from this image.',
      'Highest priority: field E — Vehicle identification number (VIN).',
      'Also extract any clearly visible fields (do not guess):',
      'license plate (field A), make, model, type, year, engine capacity, fuel type, engine number, color, number of seats, weight, registration information.',
      'Return JSON only:',
      '{"vin":"17_CHAR_VIN_OR_VIN_NOT_CONFIDENT","confidence":0.0,"vehicle":{"plate":"","make":"","model":"","type":"","year":"","engine_capacity":"","fuel_type":"","engine_number":"","color":"","seats":"","weight":"","registration":""}}'
    ].join('\n');
  }

  return [
    VIN_EXTRACT_RULES,
    'Return JSON only:',
    '{"vin":"17_CHAR_VIN_OR_VIN_NOT_CONFIDENT","confidence":0.0}'
  ].join('\n');
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new Error('invalid image data url');
  return { mime: match[1], data: match[2] };
}

function parseJsonFromText(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return {};
  }
}

function normalizeVin(raw) {
  const v = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!v || v === 'VINNOTCONFIDENT' || v === 'VIN_NOT_CONFIDENT') return 'VIN_NOT_CONFIDENT';
  return v.slice(0, 17);
}

function normalizeConfidence(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeResponse(parsed, task) {
  const vin = normalizeVin(parsed.vin);
  const confidence = normalizeConfidence(parsed.confidence);
  const readable = vin !== 'VIN_NOT_CONFIDENT' && vin.length === 17 && confidence >= 0.4;
  const out = {
    vin: readable ? vin : (vin === 'VIN_NOT_CONFIDENT' ? 'VIN_NOT_CONFIDENT' : ''),
    confidence,
    readable,
    characters: Array.isArray(parsed.characters) ? parsed.characters : (readable ? vin.split('') : [])
  };
  if (task === 'extract_tech' && parsed.vehicle && typeof parsed.vehicle === 'object') {
    out.vehicle = {
      plate: String(parsed.vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
      make: String(parsed.vehicle.make || '').trim(),
      model: String(parsed.vehicle.model || '').trim(),
      type: String(parsed.vehicle.type || '').trim(),
      year: String(parsed.vehicle.year || '').trim(),
      engine_capacity: String(parsed.vehicle.engine_capacity || parsed.vehicle.engineCapacity || '').trim(),
      fuel_type: String(parsed.vehicle.fuel_type || parsed.vehicle.fuelType || '').trim(),
      engine_number: String(parsed.vehicle.engine_number || parsed.vehicle.engineNumber || '').trim(),
      color: String(parsed.vehicle.color || '').trim(),
      seats: String(parsed.vehicle.seats || '').trim(),
      weight: String(parsed.vehicle.weight || '').trim(),
      registration: String(parsed.vehicle.registration || '').trim()
    };
  }
  return out;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function cors(res) {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers });
}
