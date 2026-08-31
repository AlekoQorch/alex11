import fs from 'fs';

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].map((k) => String(k || '').trim()).filter(Boolean);

if (!keys.length) {
  console.log('GEMINI_API_KEY not set — skip inject');
  process.exit(0);
}

const path = 'docs/verify.html';
let html = fs.readFileSync(path, 'utf8');
const safePrimary = keys[0].replace(/"/g, '');
const safeAll = keys.map((k) => k.replace(/"/g, '')).join(',');
const primaryMeta = `<meta name="default-gemini-key" content="${safePrimary}">`;
const keysMeta = `<meta name="default-gemini-keys" content="${safeAll}">`;

html = html.replace(/<meta name="default-gemini-key" content="[^"]*">/, primaryMeta);
html = html.replace(/<meta name="default-gemini-keys" content="[^"]*">/, keysMeta);
if (!html.includes('name="default-gemini-keys"')) {
  html = html.replace(primaryMeta, `${primaryMeta}\n  ${keysMeta}`);
}

fs.writeFileSync(path, html);
console.log(`Injected ${keys.length} Gemini key(s) into verify.html`);
