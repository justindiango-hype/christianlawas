/**
 * Full-screen photo viewer.
 * Opens from the clicked thumbnail (the photo grows into place), then steps
 * through the collection with arrows, keys or swipes.
 */
import { gsap } from 'gsap';

const BASE = import.meta.env.BASE_URL;
const pad = (n) => String(n).padStart(2, '0');

export function initLightbox({ reduced = false } = {}) {
  const root = document.getElementById('lightbox');
  const stage = root.querySelector('.lightbox__stage');
  const q = (k) => root.querySelector(`[data-lb="${k}"]`);
  const chrome = [root.querySelector('.lightbox__bar'), root.querySelector('.lightbox__close')];
  const D = (s) => (reduced ? 0.01 : s);
  let state = null;
  let img = null;
  let busy = false;
  let lastFocus = null;

  // tap zones on either side
  const hitPrev = Object.assign(document.createElement('button'), { className: 'lightbox__hit lightbox__hit--prev', type: 'button', tabIndex: -1 });
  const hitNext = Object.assign(document.createElement('button'), { className: 'lightbox__hit lightbox__hit--next', type: 'button', tabIndex: -1 });
  hitPrev.setAttribute('aria-hidden', 'true'); hitNext.setAttribute('aria-hidden', 'true');
  root.append(hitPrev, hitNext);

  const bestSrc = (photo) => {
    const want = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
    const s = photo.sizes.find((x) => x.w >= want) || photo.sizes[photo.sizes.length - 1];
    return BASE + s.src;
  };

  /** The largest rectangle with the photo's proportions that fits the stage. */
  function fit(photo) {
    const vw = window.innerWidth; const vh = window.innerHeight;
    const mobile = matchMedia('(max-width: 860px), (max-width: 1180px) and (orientation: portrait), (max-height: 500px) and (orientation: landscape)').matches; // same breakpoint as the CSS
    const padX = mobile ? 16 : Math.max(96, vw * 0.08);
    const padTop = mobile ? 84 : Math.max(84, vh * 0.1);
    const padBottom = mobile ? 96 : Math.max(96, vh * 0.12);
    const maxW = vw - padX * 2; const maxH = vh - padTop - padBottom;
    let w = maxW; let h = w / photo.ratio;
    if (h > maxH) { h = maxH; w = h * photo.ratio; }
    return { x: (vw - w) / 2, y: padTop + (maxH - h) / 2, w, h };
  }

  function makeImg(photo, placeholder) {
    const el = document.createElement('img');
    el.className = 'lightbox__img';
    el.alt = `${state.label} by Christian Lawas, photo ${state.index + 1}`;
    el.decoding = 'async';
    el.draggable = false;
    el.style.backgroundColor = photo.color;
    const r = fit(photo);
    Object.assign(el.style, { width: `${r.w}px`, height: `${r.h}px` });
    gsap.set(el, { x: r.x, y: r.y });
    el.src = placeholder || BASE + photo.sizes[0].src;
    const full = new Image();
    full.decoding = 'async';
    full.src = bestSrc(photo);
    full.decode?.().then(() => { if (el.isConnected) el.src = full.src; }).catch(() => {});
    return el;
  }

  function preload(i) {
    const p = state.photos[(i + state.photos.length) % state.photos.length];
    if (p) { const im = new Image(); im.src = bestSrc(p); }
  }

  function updateUI() {
    const { index, photos, label } = state;
    q('label').textContent = label;
    q('current').textContent = pad(index + 1);
    q('total').textContent = pad(photos.length);
    gsap.to(q('bar'), { scaleX: (index + 1) / photos.length, duration: D(0.8), ease: 'expo.inOut' });
    state.onIndex?.(index);
  }

  function open({ photos, index, label, thumbFor, onIndex }) {
    if (state) return;
    lastFocus = document.activeElement;
    state = { photos, index, label, thumbFor, onIndex };
    root.hidden = false;
    document.body.classList.add('is-lightbox');
    const photo = photos[index];
    const thumb = thumbFor?.(index);
    const thumbImg = thumb?.querySelector('img');
    img = makeImg(photo, thumbImg?.currentSrc);
    stage.replaceChildren(img);
    updateUI();
    const r = fit(photo);
    const tl = gsap.timeline({ onComplete: () => { busy = false; } });
    busy = true;
    tl.to(root, { backgroundColor: 'rgba(251, 248, 243, 1)', duration: D(0.7), ease: 'power2.out' }, 0);
    if (thumb && !reduced) {
      const t = thumb.getBoundingClientRect();
      if (thumb) gsap.set(thumb, { opacity: 0 });
      tl.fromTo(img, { x: t.left, y: t.top, scaleX: t.width / r.w, scaleY: t.height / r.h },
        { x: r.x, y: r.y, scaleX: 1, scaleY: 1, duration: 1, ease: 'expo.inOut' }, 0);
    } else {
      tl.fromTo(img, { opacity: 0 }, { opacity: 1, duration: D(0.5) }, 0);
    }
    tl.fromTo(chrome, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: D(0.6), ease: 'power3.out', stagger: 0.06 }, reduced ? 0 : 0.55);
    preload(index + 1); preload(index - 1);
    setTimeout(() => q('close').focus({ preventScroll: true }), reduced ? 0 : 600);
  }

  function step(dir) {
    if (!state || busy) return;
    busy = true;
    const n = state.photos.length;
    state.index = (state.index + dir + n) % n;
    const photo = state.photos[state.index];
    const old = img;
    img = makeImg(photo);
    stage.appendChild(img);
    updateUI();
    const r = fit(photo);
    const shift = Math.min(90, window.innerWidth * 0.06) * dir;
    gsap.timeline({ onComplete: () => { old.remove(); busy = false; } })
      .to(old, { x: `-=${shift}`, opacity: 0, duration: D(0.55), ease: 'power2.in' }, 0)
      .fromTo(img, { x: r.x + shift, opacity: 0 }, { x: r.x, opacity: 1, duration: D(0.8), ease: 'power3.out' }, reduced ? 0 : 0.25);
    preload(state.index + dir);
  }

  function close() {
    if (!state || busy) return;
    busy = true;
    const thumb = state.thumbFor?.(state.index);
    const photo = state.photos[state.index];
    const r = fit(photo);
    const tl = gsap.timeline({
      onComplete: () => {
        root.hidden = true;
        stage.replaceChildren();
        document.body.classList.remove('is-lightbox');
        document.querySelectorAll('.g-item').forEach((el) => gsap.set(el, { opacity: 1 }));
        (thumb || lastFocus)?.focus?.({ preventScroll: true });
        state = null; img = null; busy = false;
      },
    });
    tl.to(chrome, { opacity: 0, duration: D(0.25) }, 0)
      .to(root, { backgroundColor: 'rgba(251, 248, 243, 0)', duration: D(0.7), ease: 'power2.inOut' }, 0.1);
    const t = thumb?.getBoundingClientRect();
    const visible = t && t.bottom > 0 && t.top < window.innerHeight;
    if (visible && !reduced) {
      document.querySelectorAll('.g-item').forEach((el) => gsap.set(el, { opacity: el === thumb ? 0 : 1 }));
      tl.to(img, { x: t.left, y: t.top, scaleX: t.width / r.w, scaleY: t.height / r.h, duration: 0.9, ease: 'expo.inOut' }, 0);
    } else {
      tl.to(img, { opacity: 0, scale: 0.96, duration: D(0.5), ease: 'power2.in' }, 0);
    }
  }

  /* ---------- Input ---------- */
  q('close').addEventListener('click', close);
  q('prev').addEventListener('click', () => step(-1));
  q('next').addEventListener('click', () => step(1));
  hitPrev.addEventListener('click', () => step(-1));
  hitNext.addEventListener('click', () => step(1));

  window.addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') {
      const f = [q('close'), q('prev'), q('next')];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }, true);

  let touch = null;
  root.addEventListener('touchstart', (e) => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close(); // swipe down to close
    touch = null;
  }, { passive: true });
  root.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  window.addEventListener('resize', () => {
    if (!state || !img || busy) return;
    const r = fit(state.photos[state.index]);
    Object.assign(img.style, { width: `${r.w}px`, height: `${r.h}px` });
    gsap.set(img, { x: r.x, y: r.y });
  });

  return { open, close, get isOpen() { return !!state; } };
}
