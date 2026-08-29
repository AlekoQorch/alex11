/**
 * Optional Cloudflare Worker for secure VIN Vision AI extraction.
 * Deploy separately; set meta tag in verify.html:
 *   <meta name="tech-vision-api" content="https://your-worker.example.workers.dev/vin">
 *
 * Environment: OPENAI_API_KEY (or compatible vision endpoint)
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
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'This is a vehicle registration document. Read field E (Vehicle identification number / VIN) only. Return JSON: {"vin":"17_CHAR_VIN_OR_EMPTY"}. Do not guess. If unreadable return {"vin":""}.'
              },
              { type: 'image_url', image_url: { url: image } }
            ]
          }],
          max_tokens: 80,
          temperature: 0
        })
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      return json({ vin: String(parsed.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) });
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
