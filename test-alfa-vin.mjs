import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const ALFA_BACK = '/workspace/extracted-alfa-back.jpg';
const EXPECTED_VIN = 'ZASPAKBN2N7D24928';
const WRONG_VIN = '5PAKBN2N7D24528VE';

function toDataUrl(path) {
  return `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`;
}

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
    const chars = EXPECTED_VIN.split('');
    const payload = {
      vin: EXPECTED_VIN,
      characters: chars,
      confidence: 'high',
      readable: true
    };
    if (parsed.task === 'verify_vin') {
      payload.vin = EXPECTED_VIN;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(payload));
  });
});

await new Promise((resolve) => mockServer.listen(0, resolve));
const visionApi = `http://127.0.0.1:${mockServer.address().port}/vin`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file:///workspace/docs/verify.html?step=tech&v=153&visionApi=${encodeURIComponent(visionApi)}`);

const dataUrl = toDataUrl(ALFA_BACK);

const vinResult = await page.evaluate(async ({ url, expected, wrong }) => {
  state.photos.tech_back = url;
  state.photosOcr.tech_back = url;
  await readVinFromTechPassport('tech_back');
  while (state.vinReading) await new Promise((r) => setTimeout(r, 250));
  return {
    vin: state.vin,
    status: state.vinStatus,
    displayPhotoIsOriginal: state.photos.tech_back === url,
    serialValidWrong: serialSectionValid(wrong) && isPlausibleVinStructure(wrong),
    serialValidExpected: serialSectionValid(expected) && isPlausibleVinStructure(expected)
  };
}, { url: dataUrl, expected: EXPECTED_VIN, wrong: WRONG_VIN });

console.log('VIN result:', vinResult);
console.log('PASS:', vinResult.vin === EXPECTED_VIN ? 'YES' : 'NO');
console.log('Wrong VIN rejected:', vinResult.vin !== WRONG_VIN);
console.log('Original image kept:', vinResult.displayPhotoIsOriginal);

await browser.close();
mockServer.close();

const ok = vinResult.vin === EXPECTED_VIN && vinResult.displayPhotoIsOriginal;
process.exit(ok ? 0 : 1);
