/**
 * Navigation: the chapter rail (desktop) and the full-screen menu.
 */
import { gsap } from 'gsap';
import { getPhoto } from './photos.js';

const BASE = import.meta.env.BASE_URL;

export function initMenu({ chapters, reduced = false }) {
  const body = document.body;
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  const rail = document.querySelector('.rail');
  const railItems = [...rail.querySelectorAll('.rail__item')];
  const items = [...menu.querySelectorAll('.menu__item')];
  const masks = items.map((i) => i.querySelector('.menu__mask > span'));
  const extras = [...menu.querySelectorAll('.menu__kicker, .menu__item small, .menu__secondary, .menu__foot')];
  const preview = menu.querySelector('.menu__preview');
  const D = (s) => (reduced ? 0.01 : s);
  let open = false;
  let tl = null;
  let shown = null;
  let lastFocus = null;

  /* ---------- Preview images ---------- */
  const figures = items.map((item) => {
    const photo = getPhoto(item.dataset.preview);
    const fig = document.createElement('figure');
    if (photo) {
      fig.style.backgroundColor = photo.color;
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.dataset.srcset = photo.sizes.map((s) => `${BASE}${s.src} ${s.w}w`).join(', ');
      img.dataset.src = BASE + photo.sizes[1].src;
      img.sizes = '40vw';
      fig.appendChild(img);
    }
    preview.appendChild(fig);
    return fig;
  });
  const loadPreviews = () => figures.forEach((fig) => {
    const img = fig.querySelector('img');
    if (img && !img.src) { img.srcset = img.dataset.srcset; img.src = img.dataset.src; }
  });

  function showPreview(i, instant = false) {
    const fig = figures[i];
    if (!fig || fig === shown) return;
    const prev = shown;
    shown = fig;
    figures.forEach((f) => f.classList.toggle('is-shown', f === fig));
    const img = fig.querySelector('img');
    gsap.killTweensOf([fig, img]);
    if (instant || reduced) {
      gsap.set(fig, { clipPath: 'inset(0% 0% 0% 0%)' });
    } else {
      gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' });
      if (img) gsap.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.4, ease: 'expo.out' });
    }
    if (prev) gsap.to(prev, { clipPath: 'inset(0% 0% 100% 0%)', duration: D(0.9), ease: 'expo.inOut', delay: 0.05 });
  }
  items.forEach((item, i) => {
    item.addEventListener('mouseenter', () => showPreview(i));
    item.addEventListener('focus', () => showPreview(i));
  });

  /* ---------- Open / close ---------- */
  function currentWorkIndex() {
    const id = chapters.sections[chapters.index]?.id;
    return items.findIndex((it) => it.getAttribute('href') === `#${id}`);
  }

  function openMenu() {
    if (open || body.classList.contains('is-loading')) return;
    open = true;
    lastFocus = document.activeElement;
    loadPreviews();
    menu.hidden = false;
    body.classList.add('is-menu', 'is-overlay');
    btn.setAttribute('aria-expanded', 'true');
    const cur = currentWorkIndex();
    items.forEach((it, i) => it.classList.toggle('is-current', i === cur));
    shown = null;
    gsap.set(figures, { clipPath: 'inset(0% 0% 100% 0%)' });

    tl?.kill();
    tl = gsap.timeline();
    tl.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D(1), ease: 'expo.inOut' })
      .fromTo(masks, { yPercent: 110 }, { yPercent: 0, duration: D(1.1), ease: 'expo.out', stagger: reduced ? 0 : 0.06 }, 0.45)
      .fromTo(extras, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: D(0.8), ease: 'power3.out', stagger: reduced ? 0 : 0.03 }, 0.6)
      .add(() => showPreview(Math.max(0, cur)), 0.55);
    setTimeout(() => items[Math.max(0, cur)]?.focus({ preventScroll: true }), reduced ? 0 : 700);
  }

  function closeMenu({ then } = {}) {
    if (!open) { then?.(); return; }
    open = false;
    btn.setAttribute('aria-expanded', 'false');
    body.classList.remove('is-menu');
    tl?.kill();
    tl = gsap.timeline({
      onComplete: () => {
        menu.hidden = true;
        body.classList.remove('is-overlay');
        if (!then) lastFocus?.focus?.({ preventScroll: true });
        then?.();
      },
    });
    tl.to([...masks].reverse(), { yPercent: -110, duration: D(0.5), ease: 'power3.in', stagger: reduced ? 0 : 0.03 }, 0)
      .to(extras, { opacity: 0, duration: D(0.3) }, 0)
      .to(menu, { clipPath: 'inset(100% 0% 0% 0%)', duration: D(0.95), ease: 'expo.inOut' }, 0.2);
  }

  btn.addEventListener('click', () => (open ? closeMenu() : openMenu()));

  // Links inside the menu close it first, then move to the chapter.
  menu.addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const target = Number(link.dataset.goto);
    closeMenu({ then: () => chapters.go(target) });
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
    if (e.key === 'Tab') {
      // keep focus inside the menu and its button
      const focusables = [btn, ...menu.querySelectorAll('a[href]')];
      const i = focusables.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i === focusables.length - 1 ? 0 : i + 1);
      e.preventDefault();
      focusables[next].focus();
    }
  }, true);

  /* ---------- Dubai clock ---------- */
  const clock = menu.querySelector('[data-clock]');
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 20000);

  /* ---------- Rail ---------- */
  function setActive(section) {
    const id = section?.id;
    let any = false;
    railItems.forEach((it) => {
      const on = it.dataset.for === id;
      any = any || on;
      it.classList.toggle('is-active', on);
      if (on) it.setAttribute('aria-current', 'true'); else it.removeAttribute('aria-current');
    });
    rail.classList.toggle('is-quiet', !any);
  }

  return { open: openMenu, close: closeMenu, setActive, get isOpen() { return open; } };
}
