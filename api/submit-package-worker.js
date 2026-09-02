/**
 * Cloudflare Worker — zip package email + bid.cars VIN report.
 *
 * Secrets (wrangler secret put):
 *   RESEND_API_KEY     — https://resend.com/api-keys
 *
 * Vars:
 *   SUBMIT_TO_EMAIL    — default alex.Korchashvili@gmail.com
 *   SUBMIT_FROM_EMAIL  — verified sender in Resend (e.g. onboarding@resend.dev)
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
      const apiKey = (env.RESEND_API_KEY || '').trim();
      if (!apiKey) {
        return cors(json({
          error: 'config',
          message: 'RESEND_API_KEY არ არის კონფიგურირებული (GitHub Secret)'
        }, 503));
      }

      const form = await request.formData();
      const zipFile = form.get('zip');
      const metaRaw = form.get('meta');
      if (!zipFile || typeof zipFile.arrayBuffer !== 'function') {
        return cors(json({ error: 'zip_required' }, 400));
      }

      let meta = {};
      try {
        meta = JSON.parse(String(metaRaw || '{}'));
      } catch (_) {}

      const vin = String(meta.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
      const toEmail = (env.SUBMIT_TO_EMAIL || 'alex.Korchashvili@gmail.com').trim();
      const fromEmail = (env.SUBMIT_FROM_EMAIL || 'onboarding@resend.dev').trim();
      const zipBytes = new Uint8Array(await zipFile.arrayBuffer());
      const zipB64 = bytesToBase64(zipBytes);

      const bidReport = vin.length === 17 ? await buildBidCarsReport(vin) : null;
      const bidHtml = bidReport ? bidReport.html : '';
      const bidHtmlB64 = bidHtml ? bytesToBase64(new TextEncoder().encode(bidHtml)) : '';

      const subject = `დოკუმენტები — ${meta.name || meta.phone || 'განმცხადებელი'}${vin ? ` · VIN ${vin}` : ''}`;
      const bodyHtml = buildEmailHtml(meta, bidReport);

      const attachments = [{
        filename: zipFile.name || `documents_${Date.now()}.zip`,
        content: zipB64
      }];
      if (bidHtmlB64) {
        attachments.push({
          filename: `bidcars_${vin}.html`,
          content: bidHtmlB64
        });
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: bodyHtml,
          attachments
        })
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        return cors(json({
          error: 'email_failed',
          message: raw?.message || raw?.error || `Resend error ${res.status}`
        }, res.status >= 400 && res.status < 600 ? res.status : 502));
      }

      return cors(json({
        ok: true,
        emailId: raw.id || '',
        to: toEmail,
        bidcars: bidReport ? {
          searchUrl: bidReport.searchUrl,
          lotUrl: bidReport.lotUrl || '',
          found: !!bidReport.lotUrl
        } : null
      }));
    } catch (e) {
      return cors(json({ error: 'server', message: String(e.message || e) }, 500));
    }
  }
};

async function buildBidCarsReport(vin) {
  const searchUrl = `https://bid.cars/en/search?query=${encodeURIComponent(vin)}`;
  const bidcarUrl = 'https://bid.cars/en/bidcar';
  const out = {
    vin,
    searchUrl,
    bidcarUrl,
    lotUrl: '',
    title: '',
    imageUrl: '',
    snippet: '',
    html: ''
  };
  const urlsToTry = [
    searchUrl,
    `https://bid.cars/en/search/results?search-type=keyword&query=${encodeURIComponent(vin)}`
  ];
  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: bidcarUrl
        }
      });
      const html = await res.text();
      if (html.includes('Just a moment') || html.includes('cf-challenge')) {
        out.snippet = 'bid.cars დაცულია Cloudflare-ით — ლინკები ქვემოთაა (სქრინშოტის ნაცვლად HTML ანგარიში)';
        break;
      }
      const lotRel = html.match(/href="(\/en\/lot\/[^"?#]+)/i);
      if (lotRel) out.lotUrl = `https://bid.cars${lotRel[1]}`;
      const img = html.match(/https:\/\/pluto\.bid\.cars\/photos\/[^"'\s>]+\.(?:jpg|jpeg|webp)/i);
      if (img) out.imageUrl = img[0];
      const title = html.match(/<title>([^<]+)</i);
      if (title) out.title = decodeHtml(title[1].trim());
      if (html.includes(vin)) {
        out.snippet = 'VIN ნაპოვნია bid.cars-ზე';
        break;
      }
      if (out.lotUrl || out.imageUrl) {
        out.snippet = 'bid.cars ლოტი/ფოტო ნაპოვნია';
        break;
      }
      out.snippet = 'bid.cars ძებნაში შედეგი არ ჩანს — გახსენით ლინკი ხელით';
    } catch (e) {
      out.snippet = `bid.cars lookup failed: ${e.message}`;
    }
  }

  out.html = `<!DOCTYPE html>
<html lang="ka"><head><meta charset="utf-8"><title>bid.cars · ${vin}</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#f4f4f5;margin:0;padding:24px}
.frame{max-width:900px;margin:0 auto;border:2px solid #333;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.bar{background:#1c1c1e;padding:12px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #333}
.dot{width:10px;height:10px;border-radius:50%;background:#3f3f46}
.url{flex:1;background:#0b0b0c;border-radius:8px;padding:8px 12px;font-size:13px;color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card{padding:20px;background:linear-gradient(180deg,#18181b,#0f0f10)}
h1{margin:0 0 8px;font-size:22px}
.vin{font-family:ui-monospace,monospace;letter-spacing:.08em;background:#27272a;padding:10px 14px;border-radius:10px;display:inline-block}
img{max-width:100%;border-radius:10px;margin-top:16px;border:1px solid #333}
a{color:#2dd4bf;text-decoration:none}a:hover{text-decoration:underline}
.links{margin-top:16px;display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-block;padding:10px 14px;border-radius:10px;background:#164e63;color:#ecfeff;font-weight:600}
.note{color:#a1a1aa;font-size:12px;margin-top:20px}
</style></head>
<body><div class="frame">
<div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
<div class="url">bid.cars/en/search?query=${escapeHtml(vin)}</div></div>
<div class="card">
<h1>bid.cars VIN ანგარიში</h1>
<div class="vin">${vin}</div>
<p style="margin-top:14px">${escapeHtml(out.snippet)}</p>
<div class="links">
<a class="btn" href="${escapeHtml(searchUrl)}">ძებნა VIN-ით</a>
<a class="btn" href="${escapeHtml(bidcarUrl)}">bid.cars / bidcar</a>
${out.lotUrl ? `<a class="btn" href="${escapeHtml(out.lotUrl)}">ლოტის გვერდი</a>` : ''}
</div>
${out.imageUrl ? `<p><img src="${escapeHtml(out.imageUrl)}" alt="bid.cars photo"></p>` : `<p class="note">ფოტო ავტომატურად ვერ ჩაიტვირთა — გახსენით ძებნის ლინკი.</p>`}
<p class="note">სქრინშოტის მსგავსი HTML ანგარიში · ${new Date().toISOString()}</p>
</div></div></body></html>`;
  return out;
}

function buildEmailHtml(meta, bidReport) {
  const rows = [
    ['სახელი', meta.name],
    ['ტელეფონი', meta.phone],
    ['პლაკა', meta.plate],
    ['VIN', meta.vin],
    ['დრო', meta.at || new Date().toISOString()]
  ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:6px 12px;color:#a1a1aa">${escapeHtml(k)}</td><td style="padding:6px 12px"><strong>${escapeHtml(String(v))}</strong></td></tr>`).join('');

  const bidBlock = bidReport ? `
    <h2 style="margin-top:24px">bid.cars</h2>
    <p><a href="${escapeHtml(bidReport.searchUrl)}">ძებნა VIN-ით</a>
    · <a href="${escapeHtml(bidReport.bidcarUrl || 'https://bid.cars/en/bidcar')}">bidcar</a>
    ${bidReport.lotUrl ? ` · <a href="${escapeHtml(bidReport.lotUrl)}">ლოტი</a>` : ''}</p>
    ${bidReport.imageUrl ? `<p><img src="${escapeHtml(bidReport.imageUrl)}" alt="bid.cars" style="max-width:480px;border-radius:8px"></p>` : ''}
    <p style="color:#71717a;font-size:13px">${escapeHtml(bidReport.snippet)}</p>
    <p style="color:#71717a;font-size:13px">დეტალური HTML ანგარიში თანდართებულია (bidcars_${escapeHtml(bidReport.vin)}.html)</p>
  ` : '';

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#fafafa;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e4e4e7">
    <h1 style="margin:0 0 16px">ახალი დოკუმენტების პაკეტი</h1>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="margin-top:20px">ZIP ფაილი თანდართებულია (ყველა ფოტო + manifest.json).</p>
    ${bidBlock}
  </div></body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeHtml(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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
