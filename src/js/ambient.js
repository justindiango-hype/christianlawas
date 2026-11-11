/**
 * Ambient background: "golden-hour light" with a scatter of golden dust.
 *
 * - Light: a few very large, soft blooms of sand, blush and warm gold that
 *   drift slowly across the cream, like late sun through a curtain. Drawn on a
 *   small canvas and scaled up, so it stays soft and costs almost nothing.
 * - Dust: tiny warm specks rising slowly, a few larger and out of focus for
 *   depth, shifting slightly with the mouse.
 *
 * It sits behind the chapters (never over the photographs), only shows on the
 * chapters listed in LEVELS, pauses when nobody can see it, uses fewer specks
 * on phones, and is a single still frame for people who prefer reduced motion.
 */
// How strong the light and the dust are on each chapter (0–1). Chapters not
// listed get nothing. The hero and About keep the light very soft so the
// photographs and type lead; the moving dust stays so the page still feels alive.
const LEVELS = {
  intro: { light: 0, dust: 0.8 },     // hero: golden dust only, no light
  about: { light: 0.1, dust: 0.45 },
  contact: { light: 0.3, dust: 0.6 },
};

const BLOOMS = [
  // colour (r,g,b), strength, size (× screen), path speeds and reach
  { c: [226, 196, 150], a: 0.36, r: 0.62, sx: 0.011, sy: 0.008, ax: 0.32, ay: 0.22, ox: 0.18, oy: 0.30, p: 0.0 },  // warm gold
  { c: [232, 196, 178], a: 0.29, r: 0.55, sx: 0.007, sy: 0.012, ax: 0.28, ay: 0.26, ox: 0.78, oy: 0.62, p: 2.1 },  // blush
  { c: [214, 190, 160], a: 0.32, r: 0.70, sx: 0.009, sy: 0.006, ax: 0.22, ay: 0.20, ox: 0.55, oy: 0.10, p: 4.2 },  // sand
  { c: [240, 214, 170], a: 0.26, r: 0.45, sx: 0.013, sy: 0.010, ax: 0.30, ay: 0.30, ox: 0.30, oy: 0.85, p: 1.3 },  // honey
];

export function initAmbient({ reduced = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'ambient';
  wrap.setAttribute('aria-hidden', 'true');
  const light = document.createElement('canvas');
  light.className = 'ambient__light';
  const dust = document.createElement('canvas');
  dust.className = 'ambient__dust';
  wrap.append(light, dust);
  document.body.prepend(wrap);

  const lctx = light.getContext('2d');
  const dctx = dust.getContext('2d');
  const LIGHT_SCALE = 0.18;           // light is drawn tiny, then scaled up = free blur
  let W = 0; let H = 0; let dpr = 1;
  let specks = [];
  let running = false;
  let visible = false;
  let lightOn = true;                // skip drawing the light where it's switched off
  let raf = 0;
  let last = 0;
  let t = Math.random() * 100;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  const rand = (a, b) => a + Math.random() * (b - a);

  function makeSpeck(anywhere = true) {
    const depth = Math.random();                       // 0 = far, 1 = near
    const big = Math.random() < 0.09;                  // a few soft, out-of-focus motes
    return {
      x: rand(0, W),
      y: anywhere ? rand(0, H) : H + rand(4, 40),
      r: big ? rand(2.6, 4.8) : rand(0.5, 1.6) + depth * 0.6,
      big,
      depth,
      vy: rand(4, 11) + depth * 6,                     // px per second, upward
      sway: rand(6, 18),
      sp: rand(0.15, 0.45),
      ph: rand(0, Math.PI * 2),
      a: big ? rand(0.12, 0.24) : rand(0.35, 0.8),
      tw: rand(0.4, 1.2),
      hue: Math.random() < 0.55 ? [196, 158, 96] : [214, 182, 124],   // warm golds
    };
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    light.width = Math.max(2, Math.round(W * LIGHT_SCALE));
    light.height = Math.max(2, Math.round(H * LIGHT_SCALE));
    dust.width = Math.round(W * dpr); dust.height = Math.round(H * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mobile = matchMedia('(max-width: 860px), (max-width: 1180px) and (orientation: portrait), (max-height: 500px) and (orientation: landscape)').matches; // same breakpoint as the CSS
    const count = Math.round((mobile ? 26 : 70) * Math.min(1.4, (W * H) / (1440 * 900)) + (mobile ? 0 : 10));
    specks = Array.from({ length: Math.max(18, count) }, () => makeSpeck(true));
  }

  function drawLight(time) {
    const w = light.width; const h = light.height; const m = Math.max(w, h);
    lctx.clearRect(0, 0, w, h);
    for (const b of BLOOMS) {
      const x = (b.ox + Math.sin(time * b.sx * 6.283 + b.p) * b.ax) * w;
      const y = (b.oy + Math.cos(time * b.sy * 6.283 + b.p * 1.3) * b.ay) * h;
      const r = b.r * m * (1 + Math.sin(time * 0.05 + b.p) * 0.08);
      const g = lctx.createRadialGradient(x, y, 0, x, y, r);
      const [cr, cg, cb] = b.c;
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${b.a})`);
      g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${b.a * 0.45})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      lctx.fillStyle = g;
      lctx.fillRect(0, 0, w, h);
    }
  }

  function drawDust(dt, time) {
    dctx.clearRect(0, 0, W, H);
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    for (let i = 0; i < specks.length; i++) {
      const s = specks[i];
      s.y -= s.vy * dt;
      if (s.y < -20) { specks[i] = makeSpeck(false); continue; }
      const sway = Math.sin(time * s.sp + s.ph) * s.sway;
      const px = s.x + sway + pointer.x * (4 + s.depth * 14);
      const py = s.y + pointer.y * (3 + s.depth * 10);
      const tw = 0.65 + Math.sin(time * s.tw + s.ph) * 0.35;  // gentle twinkle
      const [r, g, b] = s.hue;
      if (s.big) {
        const grd = dctx.createRadialGradient(px, py, 0, px, py, s.r * 2.4);
        grd.addColorStop(0, `rgba(${r},${g},${b},${s.a * tw})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        dctx.fillStyle = grd;
        dctx.beginPath(); dctx.arc(px, py, s.r * 2.4, 0, Math.PI * 2); dctx.fill();
      } else {
        // a soft glow with a bright warm core, like dust catching the sun
        const a = s.a * tw;
        dctx.fillStyle = `rgba(${r},${g},${b},${a * 0.28})`;
        dctx.beginPath(); dctx.arc(px, py, s.r * 2.6, 0, Math.PI * 2); dctx.fill();
        dctx.fillStyle = `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 30)},${Math.min(255, b + 40)},${a})`;
        dctx.beginPath(); dctx.arc(px, py, s.r, 0, Math.PI * 2); dctx.fill();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;
    if (lightOn) drawLight(t);
    drawDust(dt, t);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  resize();
  if (reduced) { drawLight(t); drawDust(0, t); } // one calm, still frame
  window.addEventListener('resize', () => { resize(); if (!running) { drawLight(t); drawDust(0, t); } });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.tx = (e.clientX / W - 0.5) * 2;
    pointer.ty = (e.clientY / H - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  });
  // stop drawing once it has faded out, start again when it fades in
  wrap.addEventListener('transitionend', () => { if (!visible) stop(); });

  return {
    /** Show the light on some chapters and let it fade away on the others. */
    setChapter(id) {
      const level = LEVELS[id];
      visible = !!level;
      wrap.classList.toggle('is-on', visible);
      if (level) {
        light.style.opacity = level.light;
        lightOn = level.light > 0;
        dust.style.opacity = level.dust;
        start();
      }
    },
  };
}
