import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(source);
const output = path.join(root, 'pages-dist');
const pin = process.env.PAGES_PIN?.trim();
const apiBaseUrl = process.env.PAGES_API_BASE_URL?.trim() ?? '';
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';

if (!/^\d{4}$/.test(pin ?? '')) {
  throw new Error('GitHub SecretのPAGES_PINには4桁の数字を設定してください。');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'data'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'highway-icon.png', 'manifest.webmanifest']) {
  await cp(path.join(source, file), path.join(output, file));
}
const manifestPath = path.join(root, 'web/data/highway-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
await cp(manifestPath, path.join(output, 'data/manifest.json'));
for (const region of manifest.regions ?? []) {
  if (typeof region.file !== 'string' || !/^data\/[a-z0-9-]+\.json$/i.test(region.file)) {
    throw new Error(`道路データのファイル指定が不正です: ${region.file}`);
  }
  const filename = path.basename(region.file);
  await cp(path.join(root, 'web/data', filename), path.join(output, 'data', filename));
}
await writeFile(path.join(output, '.nojekyll'), '');

const hash = createHash('sha256').update(pin).digest('hex');
await writeFile(
  path.join(output, 'config.js'),
  `window.HIGHWAY_ASSIST_CONFIG=${JSON.stringify({ pinHash: hash, apiBaseUrl, googleClientId })};\n`,
);

const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (!html.includes('config.js')) throw new Error('config.js is not loaded by index.html');
