import { gsap } from 'gsap';

/** Rotating headline word: each word slides up and out as the next arrives. */
export function initRotator(el, { reduced = false } = {}) {
  if (!el) return null;
  const words = [...el.querySelectorAll('.rotator__word')];
  if (words.length < 2) return null;
  gsap.set(words, { y: 0, yPercent: 110 }); // y:0 clears the CSS fallback offset
  gsap.set(words[0], { yPercent: 0 });
  if (reduced) {
    let i = 0;
    const id = setInterval(() => {
      gsap.set(words[i], { yPercent: 110 });
      i = (i + 1) % words.length;
      gsap.set(words[i], { yPercent: 0 });
    }, 2600);
    return { pause() { clearInterval(id); }, play() {} };
  }
  const tl = gsap.timeline({ repeat: -1, paused: true });
  words.forEach((word, i) => {
    const next = words[(i + 1) % words.length];
    tl.to(word, { yPercent: -110, duration: 0.9, ease: 'power4.inOut' }, `+=1.6`)
      .fromTo(next, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'power4.inOut', immediateRender: false }, '<0.06');
  });
  return tl;
}
