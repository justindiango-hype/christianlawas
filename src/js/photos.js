/**
 * Fills every <figure data-photo="category:index"> with a responsive image
 * from the generated manifest. Images are attached on demand (per chapter)
 * so the first load stays light.
 */
import manifest from '../data/photos.json';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_SIZES = '(max-width: 860px) 92vw, 54vw';

export const getPhoto = (key) => {
  const [cat, i] = key.split(':');
  return manifest[cat]?.[Number(i)] ?? null;
};
export const countOf = (cat) => manifest[cat]?.length ?? 0;

export function prepareFrames(root = document) {
  root.querySelectorAll('[data-photo]').forEach((fig) => {
    if (fig.dataset.prepared) return;
    const photo = getPhoto(fig.dataset.photo);
    fig.dataset.prepared = '1';
    if (!photo) return;
    fig.style.backgroundColor = photo.color;
    const drift = document.createElement('div');
    drift.className = 'frame__drift';
    const img = document.createElement('img');
    img.alt = fig.dataset.alt || '';
    img.decoding = 'async';
    img.draggable = false;
    img.width = photo.w; img.height = photo.h;
    if (fig.dataset.position) img.style.objectPosition = fig.dataset.position;
    drift.appendChild(img);
    const edge = document.createElement('span');
    edge.className = 'frame__edge';
    fig.append(drift, edge);
  });
  document.querySelectorAll('[data-count]').forEach((el) => {
    const n = countOf(el.dataset.count);
    el.textContent = n ? String(n).padStart(2, '0') : '';
  });
}

/** Attach sources for every frame inside a section. Resolves when all have loaded. */
export function hydrate(section) {
  if (!section) return Promise.resolve();
  const jobs = [];
  section.querySelectorAll('[data-photo]').forEach((fig) => {
    const img = fig.querySelector('img');
    const photo = getPhoto(fig.dataset.photo);
    if (!img || !photo) return;
    if (!img.src) {
      img.sizes = fig.dataset.sizes || DEFAULT_SIZES;
      img.srcset = photo.sizes.map((s) => `${BASE}${s.src} ${s.w}w`).join(', ');
      img.src = BASE + photo.sizes[1].src;
    }
    jobs.push(
      (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))
        .then(() => img.decode?.().catch(() => {}))
        .then(() => img.classList.add('is-loaded'))
    );
  });
  return Promise.all(jobs);
}
