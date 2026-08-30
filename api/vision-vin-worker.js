/**
 * Cloudflare Worker for secure VIN Vision AI extraction.
 * Deploy separately; set meta tag in verify.html:
 *   <meta name="tech-vision-api" content="https://your-worker.example.workers.dev/vin">
 *
 * Environment: OPENAI_API_KEY (or compatible vision endpoint)
 *
 * Tasks:
 *   extract_vin  — locate field E and read VIN character-by-character from the image
 *   verify_vin   — re-check a candidate VIN (or two) against the actual printed characters
 */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    try {
      const body = await request.json();
      const image = body.image || '';
      if (!image.startsWith('data:image/')) {
        return json({ error: 'image required' }, 400);
      }
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        return json({ error: 'OPENAI_API_KEY not configured' }, 503);
      }

      const task = body.task || 'extract_vin';
      const prompt = buildPrompt(task, body);
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: env.VISION_MODEL || 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image, detail: 'high' } }
            ]
          }],
          max_tokens: 320,
          temperature: 0
        })
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const parsed = parseVisionJson(text);
      return json(normalizeVisionResponse(parsed));
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  }
};

function buildPrompt(task, body) {
  const baseRules = [
    'You are reading a vehicle registration document (tech passport).',
    'Inspect the ACTUAL image pixels. Do not guess or invent characters.',
    'VIN must be exactly 17 characters. Allowed: A-H, J-N, P, R-Z, 0-9. No I, O, or Q.',
    'Read every character individually from left to right.',
    'If genuinely unreadable, set readable:false and vin:"".'
  ].join(' ');

  if (task === 'verify_vin') {
    const candidates = [body.vin, body.altVin].filter(Boolean).map((v) => String(v).toUpperCase());
    return [
      baseRules,
      'Task: VERIFY which candidate VIN (if any) matches what is ACTUALLY PRINTED next to field E (Vehicle identification number).',
      `Candidates: ${candidates.join(' OR ') || 'none provided'}.`,
      'Look at each of the 17 character positions in the image. Compare character-by-character.',
      'Return JSON only:',
      '{"vin":"BEST_MATCH_OR_EMPTY","characters":["C1",...,"C17"],"confidence":"high|medium|low|none","readable":true|false,"mismatches":[{"pos":1,"seen":"X","expected":"Y"}]}'
    ].join(' ');
  }

  return [
    baseRules,
    'Task: FIND field E ("Vehicle identification number" / VIN) anywhere in the image using layout understanding — not fixed coordinates.',
    'Read the 17 characters printed next to that label, one character at a time.',
    'Do NOT use OCR text alone — read from the image.',
    'Return JSON only:',
    '{"vin":"17_CHAR_VIN_OR_EMPTY","characters":["C1","C2",...,"C17"],"confidence":"high|medium|low|none","readable":true|false}'
  ].join(' ');
}

function parseVisionJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return {};
  }
}

function normalizeVisionResponse(parsed) {
  const rawChars = Array.isArray(parsed.characters) ? parsed.characters : [];
  const chars = rawChars.map((c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1));
  let vin = String(parsed.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
  if (chars.length === 17 && chars.every(Boolean)) vin = chars.join('');
  return {
    vin,
    characters: chars.length === 17 ? chars : vin.split(''),
    confidence: String(parsed.confidence || 'none'),
    readable: parsed.readable !== false && vin.length === 17,
    mismatches: Array.isArray(parsed.mismatches) ? parsed.mismatches : []
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
