/**
 * Photo pipeline
 * Reads originals from /photos/<category>/ and writes responsive WebP files to
 * /public/img/<category>/ plus a manifest at /src/data/photos.json.
 *
 * - Incremental: files that already exist are skipped, so re-runs are fast.
 * - Ordering: an optional photos/<category>/order.txt lists filenames, one per
 *   line. Listed files come first (the first one is the chapter cover); the rest
 *   follow alphabetically.
 * - Usage: npm run optimize      (also runs automatically before dev and build)
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, 'public', 'img');
const MANIFEST = path.join(ROOT, 'src', 'data', 'photos.json');
const WIDTHS = [640, 1280, 2048];
const QUALITY = 76;
const BUDGET_MS = Number(process.env.OPTIMIZE_BUDGET_MS || 0); // 0 = no limit
const started = Date.now();
sharp.concurrency(2);

const slugify = (name) =>
  name.replace(/\.[^.]+$/, '').toLowerCase()
    .replace(/^copy of\s+/, '').replace(/\s*-\s*copy$/, '')
    .replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const exists = (p) => fs.access(p).then(() => true, () => false);

async function readOrder(dir) {
  try {
    const txt = await fs.readFile(path.join(dir, 'order.txt'), 'utf8');
    return txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } catch { return []; }
}

let cache = {};

async function processImage(file, category) {
  const id = slugify(path.basename(file));
  const outDir = path.join(OUT, category);
  const cached = (cache[category] || []).find((c) => c.id === id);
  if (cached && (await Promise.all(cached.sizes.map((s) => exists(path.join(ROOT, 'public', s.src))))).every(Boolean)) return cached;
  await fs.mkdir(outDir, { recursive: true });
  const base = sharp(file, { failOn: 'none' }).rotate();
  const meta = await base.metadata();
  const portrait = (meta.orientation || 1) >= 5;
  const w = portrait ? meta.height : meta.width;
  const h = portrait ? meta.width : meta.height;

  const sizes = [];
  for (const target of WIDTHS) {
    const width = Math.min(target, w);
    const name = `${id}-${target}.webp`;
    const dest = path.join(outDir, name);
    if (!(await exists(dest))) {
      if (BUDGET_MS && Date.now() - started > BUDGET_MS) return null;
      await sharp(file, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 4 }).toFile(dest);
    }
    sizes.push({ w: width, src: `img/${category}/${name}` });
  }
  const { dominant } = await sharp(file, { failOn: 'none' }).resize(64).stats();
  const color = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
  return { id, w, h, ratio: +(w / h).toFixed(4), color, sizes };
}

async function main() {
  const manifest = {};
  let pending = 0;
  try { cache = JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch { cache = {}; }
  const categories = (await fs.readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();

  for (const category of categories) {
    const dir = path.join(SRC, category);
    const files = (await fs.readdir(dir)).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f)).sort();
    const order = await readOrder(dir);
    const ordered = [...order.filter((f) => files.includes(f)), ...files.filter((f) => !order.includes(f))];
    manifest[category] = [];
    for (const f of ordered) {
      const item = await processImage(path.join(dir, f), category);
      if (item) manifest[category].push(item); else pending++;
    }
    console.log(`  ${category.padEnd(10)} ${manifest[category].length} photos`);
  }
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(pending ? `Paused with ${pending} photos left. Run again to continue.` : 'Photos ready.');
}

main().catch((e) => { console.error(e); process.exit(1); });
