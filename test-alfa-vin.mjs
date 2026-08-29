import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const ALFA_BACK = '/home/ubuntu/.cursor/projects/workspace/assets/01a04caa-78a7-76d8-982a-033876fb31bf.jpg';
const EXPECTED_VIN = 'ZASPAKBN2N7D24928';
const WRONG_VIN = '5PAKBN2N7D24528VE';

function toDataUrl(path) {
  return `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///workspace/docs/verify.html?step=tech&v=145');

const dataUrl = toDataUrl(ALFA_BACK);
const cropped = await page.evaluate(async (url) => {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = Math.round(img.naturalHeight * 0.42);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
  const topCrop = c.toDataURL('image/jpeg', 0.95);
  return cropTechPassportFromPhoto(topCrop);
}, dataUrl);

writeFileSync('/workspace/out-alfa-crop.jpg', Buffer.from(cropped.split(',')[1], 'base64'));

const vinResult = await page.evaluate(async ({ cropped, expected, wrong }) => {
  state.photos.tech_back = cropped;
  state.photosOcr.tech_back = cropped;
  await readVinFromTechPassport('tech_back');
  return {
    vin: state.vin,
    status: state.vinStatus,
    serialValidWrong: serialSectionValid(wrong) && isPlausibleVinStructure(wrong),
    serialValidExpected: serialSectionValid(expected) && isPlausibleVinStructure(expected)
  };
}, { cropped, expected: EXPECTED_VIN, wrong: WRONG_VIN });

console.log('VIN result:', vinResult);
console.log('PASS:', vinResult.vin === EXPECTED_VIN ? 'YES' : 'NO');
console.log('Wrong VIN rejected:', !vinResult.serialValidWrong);

await browser.close();
process.exit(vinResult.vin === EXPECTED_VIN ? 0 : 1);
