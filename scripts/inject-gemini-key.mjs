import fs from 'fs';

const key = String(process.env.GEMINI_API_KEY || '').trim();
if (!key) {
  console.log('GEMINI_API_KEY not set — skip inject');
  process.exit(0);
}

const path = 'docs/verify.html';
let html = fs.readFileSync(path, 'utf8');
const safe = key.replace(/"/g, '');
const meta = `<meta name="default-gemini-key" content="${safe}">`;

if (html.includes('name="default-gemini-key"')) {
  html = html.replace(/<meta name="default-gemini-key" content="[^"]*">/, meta);
} else {
  html = html.replace('</head>', `  ${meta}\n</head>`);
}

fs.writeFileSync(path, html);
console.log('Injected default-gemini-key meta into verify.html');
