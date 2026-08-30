import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const ALFA_BACK = '/workspace/extracted-alfa-back.jpg';
const EXPECTED_VIN = 'ZASPAKBN2N7D24928';

const mockServer = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const parsed = JSON.parse(body || '{}');
    const payload = {
      vin: EXPECTED_VIN,
      confidence: 0.94,
      readable: true,
      vehicle: { make: 'Alfa Romeo', model: 'Giulietta' }
    };
    if (parsed.task === 'verify_vin') payload.vin = EXPECTED_VIN;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(payload));
  });
});

await new Promise((resolve) => mockServer.listen(0, resolve));
const geminiApi = `http://127.0.0.1:${mockServer.address().port}/tech`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file:///workspace/docs/verify.html?step=tech&v=156&geminiApi=${encodeURIComponent(geminiApi)}`);

const dataUrl = `data:image/jpeg;base64,${readFileSync(ALFA_BACK).toString('base64')}`;

const result = await page.evaluate(async ({ url, expected }) => {
  state.photos.tech_back = url;
  state.photosOcr.tech_back = url;
  await readVinFromTechPassport('tech_back');
  while (state.vinReading) await new Promise((r) => setTimeout(r, 250));
  return {
    vin: state.vin,
    status: state.vinStatus,
    techExtracted: state.techExtracted,
    originalKept: state.photos.tech_back === url,
    geminiEnabled: !!TECH_GEMINI_API
  };
}, { url: dataUrl, expected: EXPECTED_VIN });

console.log('Gemini mock result:', result);
console.log('PASS:', result.vin === EXPECTED_VIN && result.originalKept && result.geminiEnabled);

await browser.close();
mockServer.close();

process.exit(result.vin === EXPECTED_VIN && result.originalKept ? 0 : 1);
