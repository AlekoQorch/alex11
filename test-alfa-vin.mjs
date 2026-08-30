import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const ALFA_BACK = '/workspace/extracted-alfa-back.jpg';
const EXPECTED_VIN = 'ZASPAKBN2N7D24928';
const WRONG_VIN = '5PAKBN2N7D24528VE';

function toDataUrl(path) {
  return `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///workspace/docs/verify.html?step=tech&v=155');

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

const ok = vinResult.vin === EXPECTED_VIN && vinResult.displayPhotoIsOriginal;
process.exit(ok ? 0 : 1);
