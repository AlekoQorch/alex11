import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const CASES = [
  { img: '01a049d7-edc9-78fc-837f-61b7126e2f22.jpg', vin: '1C4RJFBG8GC367495', name: 'Jeep raw' },
  { img: '01a049d8-17eb-7c11-b522-6799031feaec.jpg', vin: '1C4RJFBG8GC367495', name: 'Jeep screenshot' },
  { img: '01a04955-05dd-75a5-b5f2-8d18c37bce44.jpg', vin: '5UX33EM09R9U53679', name: 'BMW' },
  { img: '01a04955-0481-7bab-b4f4-161f58bfdcb0.jpg', vin: 'WDC2539151F716609', name: 'GLC' }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///workspace/docs/verify.html?step=tech&v=156');

for (const c of CASES) {
  const url = `data:image/jpeg;base64,${readFileSync(`/home/ubuntu/.cursor/projects/workspace/assets/${c.img}`).toString('base64')}`;
  const result = await page.evaluate(async ({ url, expected }) => {
    state.vin = '';
    state.photos.tech_back = url;
    state.photosOcr.tech_back = url;
    await readVinFromTechPassport('tech_back');
    while (state.vinReading) await new Promise((r) => setTimeout(r, 250));
    return { vin: state.vin, status: state.vinStatus, ok: state.vin === expected };
  }, { url, expected: c.vin });
  console.log(c.name, result);
}

await browser.close();
