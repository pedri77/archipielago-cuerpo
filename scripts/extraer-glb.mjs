// Convierte el atlas vendorizado (models/*.js en base64 y data/*.js) en ficheros estáticos:
//   public/models/<sistema>.glb  y  public/data/anatomia.<lang>.json
// Uso: node scripts/extraer-glb.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'vendor/human-body');
const ctx = { window: {} };
vm.createContext(ctx);
const run = f => vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });

mkdirSync(join(root, 'public/models'), { recursive: true });
mkdirSync(join(root, 'public/data'), { recursive: true });

for (const f of readdirSync(join(src, 'models')).filter(f => f.endsWith('.js'))) run(join(src, 'models', f));
const sizes = {};
for (const [k, b64] of Object.entries(ctx.window.ANAT_MODELS)) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.subarray(0, 4).toString() !== 'glTF') throw new Error(`${k}: no es GLB`);
  writeFileSync(join(root, 'public/models', `${k}.glb`), buf);
  sizes[k] = buf.length;
}

run(join(src, 'data/anatomia.js'));
run(join(src, 'data/anatomia.en.js'));
const es = ctx.window.ANAT_DATA;
const en = ctx.window.ANAT_I18N.en;
const files = Object.fromEntries(Object.entries(sizes).map(([k, bytes]) => [k, { bytes }]));
const base = { parts: es.parts, files };
writeFileSync(join(root, 'public/data/anatomia.es.json'), JSON.stringify({ ...base, systems: es.systems, concepts: es.concepts }));
const sysEn = es.systems.map(s => ({ ...s, ...(en.systems[s.k] || {}) }));
const concEn = es.concepts.map((c, i) => {
  const t = en.concepts[i];
  return t ? { ...c, n: t[0], g: t[1] ?? c.g, d: t[2] ?? c.d, f: t[3] ?? c.f, gk: c.g } : c;
});
writeFileSync(join(root, 'public/data/anatomia.en.json'), JSON.stringify({ ...base, systems: sysEn, concepts: concEn }));
console.log('GLB:', Object.entries(sizes).map(([k, b]) => `${k} ${(b / 1048576).toFixed(2)} MB`).join(', '));
console.log('Total', (Object.values(sizes).reduce((a, b) => a + b, 0) / 1048576).toFixed(2), 'MB');
