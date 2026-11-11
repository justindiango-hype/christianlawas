/**
 * Full-screen chapters.
 * One chapter is on screen at a time. Wheel, swipe, keyboard, the arrow
 * buttons and any [data-goto] link move between them with a curtain wipe.
 */
import { gsap } from 'gsap';
import { hydrate } from './photos.js';

const BACKGROUNDS = { about: '#FBF8F3', contact: '#3A2A1F' }; // Enquiries is the dark closing chapter
const DEFAULT_BG = '#F5EFE6';

export function initChapters({ reduced = false, onChange = () => {} } = {}) {
  const sections = [...document.querySelectorAll('.chapter')];
  const last = sections.length - 1;
  const state = { index: 0, busy: false, drift: null, queued: 0 };
  const D = (s) => (reduced ? 0.01 : s);

  const reveals = (s) => [...s.querySelectorAll('[data-reveal]')];
  const frames = (s) => [...s.querySelectorAll('.frame')];
  const bgFor = (s) => BACKGROUNDS[s.id] || DEFAULT_BG;

  const startDrift = (s) => {
    state.drift?.kill();
    const drifts = s.querySelectorAll('.frame__drift');
    if (reduced || !drifts.length) return;
    state.drift = gsap.fromTo(drifts, { scale: 1 }, { scale: 1.06, duration: 16, ease: 'none', overwrite: true });
  };

  /** Reveal a chapter's frames with a sideways wipe and a travelling hairline. */
  function wipeIn(s, dir, at, tl) {
    frames(s).forEach((fig, n) => {
      const from = dir >= 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
      const edge = fig.querySelector('.frame__edge');
      const img = fig.querySelector('img');
      const t = at + n * 0.14;
      tl.fromTo(fig, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D(1.15), ease: 'expo.inOut' }, t);
      // the hero photo does its own camera-focus zoom (focus.js), so skip it there
      if (img && s.id !== 'intro') tl.fromTo(img, { scale: 1.16 }, { scale: 1, duration: D(1.8), ease: 'expo.out' }, t + 0.1);
      if (edge && !reduced) {
        tl.fromTo(edge, { left: dir >= 0 ? '0%' : '100%', opacity: 0 }, { left: dir >= 0 ? '100%' : '0%', duration: D(1.15), ease: 'expo.inOut' }, t)
          .to(edge, { opacity: 0.9, duration: 0.15 }, t + 0.05)
          .to(edge, { opacity: 0, duration: 0.25 }, t + 0.9);
      }
    });
  }

  function textIn(s, at, tl) {
    const items = reveals(s);
    const lines = [...s.querySelectorAll('.intro__title .line > span')];
    tl.fromTo(items, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: D(0.95), ease: 'power3.out', stagger: reduced ? 0 : 0.075 }, at);
    if (lines.length) tl.fromTo(lines, { yPercent: 105 }, { yPercent: 0, duration: D(1.2), ease: 'expo.out', stagger: 0.09 }, at);
  }

  function setUI(i) {
    onChange(i, sections[i]);
    const id = sections[i].id;
    history.replaceState(null, '', i === 0 ? location.pathname + location.search : `#${id}`);
  }

  function go(target, { first = false } = {}) {
    const next = Math.max(0, Math.min(last, target));
    if (state.busy || (next === state.index && !first)) return;
    const cur = sections[state.index];
    const nxt = sections[next];
    const dir = first ? 1 : Math.sign(next - state.index);
    state.busy = true;

    hydrate(nxt);
    hydrate(sections[next + 1]);
    hydrate(sections[next - 1]);

    // If we're coming back to a chapter that was still fading out, stop that first.
    if (cur !== nxt) gsap.killTweensOf([...reveals(nxt), ...frames(nxt), ...nxt.querySelectorAll('.frame img, .frame__edge')]);

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        // Only tidy up the old chapter if the visitor hasn't already come back to it.
        if (cur !== nxt && sections[state.index] !== cur) {
          cur.classList.remove('is-active');
          gsap.set([...reveals(cur), ...frames(cur)], { clearProps: 'opacity,transform,clipPath' });
        }
        startDrift(nxt);
      },
    });
    // Accept the next move once the new chapter has landed, before the last
    // details finish settling, so quick consecutive swipes feel responsive.
    tl.call(() => {
      state.busy = false;
      if (state.queued) { const q = state.queued; state.queued = 0; go(state.index + q); }
    }, null, reduced ? 0.05 : 1.05);

    if (!first && cur !== nxt) {
      tl.to(reveals(cur), { y: -26 * dir, opacity: 0, duration: D(0.55), ease: 'power2.in', stagger: reduced ? 0 : 0.03 }, 0)
        .to(frames(cur), { opacity: 0, duration: D(0.6), ease: 'power2.inOut', stagger: 0.05 }, 0.05);
    }
    const inAt = first ? 0 : reduced ? 0 : 0.42;
    const show = () => {
      nxt.classList.add('is-active');
      gsap.set(reveals(nxt), { opacity: 0 });
      gsap.set(frames(nxt), { opacity: 1 });
    };
    if (first) show(); else tl.add(show, inAt);
    tl.to(document.body, { backgroundColor: bgFor(nxt), duration: D(1), ease: 'power2.inOut' }, first ? 0 : 0.2);
    wipeIn(nxt, dir, inAt, tl);
    textIn(nxt, inAt + (reduced ? 0 : 0.38), tl);

    state.index = next;
    setUI(next);
  }

  /* ---------- Input ---------- */
  const isScrollable = (el) => {
    const area = el?.closest?.('[data-scroll-area]');
    return area && area.scrollHeight > area.clientHeight + 2 ? area : null;
  };
  const atEdge = (area, dir) => (dir > 0
    ? Math.ceil(area.scrollTop + area.clientHeight) >= area.scrollHeight - 1
    : area.scrollTop <= 1);

  const blocked = () => document.body.classList.contains('is-loading') || document.body.classList.contains('is-overlay');

  /*
   * Wheel & trackpad.
   * A trackpad sends a stream of small events (then a long tail of momentum),
   * a mouse wheel sends a few large ones. Treat each stream as one gesture:
   * add up its movement and move one chapter once it passes a threshold.
   * The momentum tail is ignored; a fresh, sharper push starts a new gesture.
   */
  const wheel = { last: 0, acc: 0, armed: true, prev: 0, lastMove: 0 };
  window.addEventListener('wheel', (e) => {
    if (blocked()) return;
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines → pixels (Firefox)
    const dir = Math.sign(d);
    if (!dir) return;
    const area = isScrollable(e.target);
    if (area && !atEdge(area, dir)) return;

    const now = performance.now();
    const gap = now - wheel.last;
    wheel.last = now;
    const mag = Math.abs(d);
    // A new gesture is a pause in the stream, a change of direction, or a
    // clearly harder push long after the last move (never mid-momentum jitter).
    const paused = gap > 180;
    const reversed = wheel.acc !== 0 && Math.sign(wheel.acc) !== dir;
    const push = mag > 40 && mag > wheel.prev * 3 && now - wheel.lastMove > 700;
    wheel.prev = mag;
    if (paused || reversed || push) { wheel.acc = 0; wheel.armed = true; wheel.fresh = paused || reversed; }
    wheel.acc += d;

    if (wheel.armed && Math.abs(wheel.acc) > 28) {
      wheel.armed = false;
      if (!state.busy) { wheel.lastMove = now; go(state.index + dir); }
      // only a deliberate new swipe is remembered while a chapter is still moving
      else if (wheel.fresh) state.queued = dir;
    }
  }, { passive: true });

  let touch = null;
  window.addEventListener('touchstart', (e) => {
    const area = isScrollable(e.target);
    touch = { y: e.touches[0].clientY, x: e.touches[0].clientX, area, top: area ? atEdge(area, -1) : true, bottom: area ? atEdge(area, 1) : true };
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!touch || blocked()) return;
    const dy = touch.y - e.changedTouches[0].clientY;
    const dx = touch.x - e.changedTouches[0].clientX;
    const dir = Math.sign(dy);
    if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx)) {
      if (!touch.area || (dir > 0 ? touch.bottom : touch.top)) go(state.index + dir);
    }
    touch = null;
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (blocked() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    const keys = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowRight: 1, ArrowUp: -1, PageUp: -1, ArrowLeft: -1 };
    if (e.key in keys) {
      if (e.key === ' ' && e.shiftKey) { e.preventDefault(); go(state.index - 1); return; }
      e.preventDefault(); go(state.index + keys[e.key]);
    } else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(last); }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto]');
    if (!link) return;
    e.preventDefault();
    go(Number(link.dataset.goto));
  });

  // Keep focus inside the visible chapter: tabbing into a hidden one moves there.
  document.addEventListener('focusin', (e) => {
    const s = e.target.closest?.('.chapter');
    if (s && !s.classList.contains('is-active')) go(sections.indexOf(s));
  });

  const startIndex = Math.max(0, sections.findIndex((s) => `#${s.id}` === location.hash.split('/')[0]));

  return {
    go,
    next: () => go(state.index + 1),
    prev: () => go(state.index - 1),
    get index() { return state.index; },
    sections,
    startIndex,
    /** First entrance, called by the loader once it lifts. */
    enter() {
      state.index = startIndex;
      go(startIndex, { first: true });
    },
  };
}
