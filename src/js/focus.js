/**
 * Hero "camera focusing" effect.
 * The portrait starts soft and slightly zoomed, hunts in and out of focus a
 * couple of times like autofocus searching, then the frame flashes white for
 * half a second like a shutter firing, and the photo is sharp behind it. A faint
 * viewfinder (corner marks + focus box) sits over it while it hunts, flashes
 * as focus locks, then fades away.
 */
import { gsap } from 'gsap';

export function initHeroFocus({ reduced = false } = {}) {
  const frame = document.querySelector('.frame--intro');
  if (!frame) return { play() {} };

  const vf = document.createElement('div');
  vf.className = 'viewfinder';
  vf.setAttribute('aria-hidden', 'true');
  vf.innerHTML = '<i class="vf-c vf-tl"></i><i class="vf-c vf-tr"></i><i class="vf-c vf-bl"></i><i class="vf-c vf-br"></i><span class="vf-box"></span>';
  frame.appendChild(vf);
  const flash = document.createElement('span');   // the white "shutter" flash
  flash.className = 'shutter-flash';
  flash.setAttribute('aria-hidden', 'true');
  frame.appendChild(flash);
  const box = vf.querySelector('.vf-box');
  let tl = null;

  return {
    /** Run the focus sequence. `delay` lines it up with the chapter's wipe. */
    play(delay = 0) {
      const img = frame.querySelector('img');
      if (!img || reduced) return;
      tl?.kill();
      const blur = { b: 18, s: 1.14, l: 1.08 };
      const apply = () => {
        img.style.filter = `blur(${blur.b.toFixed(2)}px) brightness(${blur.l.toFixed(3)})`;
        img.style.transform = `scale(${blur.s.toFixed(4)})`;
      };
      apply();
      tl = gsap.timeline({ delay, onUpdate: apply, onComplete: () => { img.style.filter = ''; img.style.transform = ''; } });
      tl.set([vf, flash], { opacity: 0 })
        .set(box, { scale: 1.5, opacity: 0, borderColor: 'rgba(251,248,243,.85)' })
        .to(vf, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.15)
        .to(box, { opacity: 1, scale: 1.25, duration: 0.4, ease: 'power2.out' }, 0.15)
        // hunting: soft → nearly sharp → soft again → nearly sharp → a touch soft…
        .to(blur, { b: 3.2, s: 1.05, duration: 0.5, ease: 'power2.inOut' }, 0.2)
        .to(box, { scale: 0.92, duration: 0.5, ease: 'power2.inOut' }, 0.2)
        .to(blur, { b: 10, s: 1.09, duration: 0.32, ease: 'power2.inOut' })
        .to(box, { scale: 1.12, duration: 0.32, ease: 'power2.inOut' }, '<')
        .to(blur, { b: 1.6, s: 1.025, duration: 0.36, ease: 'power2.inOut' })
        .to(box, { scale: 0.97, duration: 0.36, ease: 'power2.inOut' }, '<')
        .to(blur, { b: 5, s: 1.045, duration: 0.22, ease: 'power2.inOut' })
        .to(box, { scale: 1.05, duration: 0.22, ease: 'power2.inOut' }, '<')
        // …lock: a white shutter flash for half a second, and the photo is sharp behind it.
        .addLabel('shot')
        .to(flash, { opacity: 1, duration: 0.06, ease: 'power1.out' }, 'shot')
        .set(blur, { b: 0, s: 1, l: 1 }, 'shot+=0.06')
        .set(box, { scale: 1, borderColor: 'rgba(214,195,168,1)' }, 'shot+=0.06')      // focus confirmed
        .to(flash, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 'shot+=0.26')    // fully white for 0.2s, then fades
        .to(box, { opacity: 0, duration: 0.12, repeat: 1, yoyo: true }, '>')               // double blink
        .to(vf, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, '+=0.35');
    },
  };
}
