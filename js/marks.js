/* Cutie mark generator: every article title deterministically gets its own mark. */
(function () {
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function rng(seed) {
    let s = seed || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  const PALETTES = [
    ['#e8467c', '#ffd1e3'], ['#7a4fd6', '#d9c6ff'], ['#f0a020', '#fff0b3'],
    ['#2aa7e0', '#c9efff'], ['#d63a3a', '#ffc9b8'], ['#2fb37a', '#c8f5dd'],
    ['#f26ac0', '#5fd0f0'], ['#3b5bd6', '#f5d76e'], ['#ff8a3d', '#ffe08a'],
    ['#9b59b6', '#f7a8d8'], ['#14a3a3', '#f9e79f'], ['#c0392b', '#f5b041'],
  ];

  // Motifs drawn in a 100x100 box, centered at 50,50. `a` main color, `b` accent.
  const MOTIFS = {
    star: (a, b) => `<path d="M50 6 61 38 95 38 67 58 78 92 50 71 22 92 33 58 5 38 39 38Z" fill="${a}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>`,
    heart: (a, b) => `<path d="M50 90C20 68 6 52 6 33 6 18 18 8 31 8c9 0 16 5 19 12 3-7 10-12 19-12 13 0 25 10 25 25 0 19-14 35-44 57Z" fill="${a}"/><path d="M28 22c-6 2-9 8-8 14" stroke="${b}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    diamond: (a, b) => `<path d="M50 94 8 38 26 12h48l18 26Z" fill="${a}"/><path d="M8 38h84M26 12l12 26 12 56 12-56 12-26M38 38l12-26 12 26" stroke="${b}" stroke-width="3.5" fill="none" stroke-linejoin="round"/>`,
    apple: (a, b) => `<path d="M50 30c-8-8-34-10-38 16-3 22 12 46 28 46 5 0 7-3 10-3s5 3 10 3c16 0 31-24 28-46C84 20 58 22 50 30Z" fill="${a}"/><path d="M50 30c0-10 3-18 8-24" stroke="#6b4423" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M56 18c8-10 22-10 26-4-8 8-18 9-26 4Z" fill="#3fae49"/><ellipse cx="30" cy="48" rx="6" ry="10" fill="${b}" opacity=".7"/>`,
    balloon: (a, b) => `<ellipse cx="50" cy="38" rx="27" ry="32" fill="${a}"/><path d="M46 69h8l-4 7Z" fill="${a}"/><path d="M50 76c-6 8 6 12 0 22" stroke="${b}" stroke-width="3" fill="none"/><ellipse cx="40" cy="26" rx="6" ry="10" fill="#fff" opacity=".55"/>`,
    butterfly: (a, b) => `<ellipse cx="30" cy="32" rx="22" ry="17" transform="rotate(-30 30 32)" fill="${a}"/><ellipse cx="70" cy="32" rx="22" ry="17" transform="rotate(30 70 32)" fill="${a}"/><ellipse cx="34" cy="66" rx="14" ry="11" transform="rotate(30 34 66)" fill="${b}"/><ellipse cx="66" cy="66" rx="14" ry="11" transform="rotate(-30 66 66)" fill="${b}"/><rect x="47" y="24" width="6" height="52" rx="3" fill="#4a3060"/>`,
    bolt: (a, b) => `<path d="M14 40c-8 0-12-7-10-13 2-7 9-9 14-7 2-8 10-13 19-11 7 1 11 6 12 11 6-3 15 0 16 8 7 0 11 5 10 11s-6 9-12 9H14Z" fill="#fff" stroke="#9fd8f5" stroke-width="3"/><path d="M52 44 34 72h14l-8 26 28-36H52l8-18Z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
    moon: (a, b) => `<path d="M64 8a42 42 0 1 0 28 62A36 36 0 0 1 64 8Z" fill="${a}"/><circle cx="36" cy="50" r="5" fill="${b}"/><circle cx="48" cy="72" r="3.5" fill="${b}"/><circle cx="30" cy="30" r="3" fill="${b}"/>`,
    sun: (a, b) => `<g stroke="${b}" stroke-width="7" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(r => `<path d="M50 4v14" transform="rotate(${r} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="24" fill="${a}"/>`,
    note: (a, b) => `<path d="M36 74V22l46-10v52" stroke="${a}" stroke-width="7" fill="none" stroke-linejoin="round"/><path d="M36 30l46-10" stroke="${a}" stroke-width="12"/><ellipse cx="26" cy="76" rx="13" ry="10" fill="${a}"/><ellipse cx="72" cy="66" rx="13" ry="10" fill="${a}"/><circle cx="22" cy="72" r="3" fill="${b}"/>`,
    flower: (a, b) => `${[0, 72, 144, 216, 288].map(r => `<ellipse cx="50" cy="26" rx="14" ry="22" transform="rotate(${r} 50 50)" fill="${a}"/>`).join('')}<circle cx="50" cy="50" r="13" fill="${b}"/>`,
    sparkle: (a, b) => `<path d="M50 4C54 38 62 46 96 50 62 54 54 62 50 96 46 62 38 54 4 50 38 46 46 38 50 4Z" fill="${a}"/><path d="M50 30c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20Z" fill="${b}"/>`,
    quill: (a, b) => `<path d="M84 8C50 14 26 40 20 80l8 2c8-30 26-50 52-62C66 34 50 48 40 66 66 52 82 32 84 8Z" fill="${a}"/><path d="M84 8 24 82" stroke="${b}" stroke-width="3"/><path d="M24 80 14 96" stroke="#4a3060" stroke-width="4" stroke-linecap="round"/>`,
    cloud: (a, b) => `<path d="M22 72c-12 0-18-9-16-18 2-8 10-12 17-10 1-12 12-21 25-19 9 1 15 7 18 14 9-5 22 0 24 11 9 1 14 8 12 15-1 5-6 7-11 7Z" fill="${a}" stroke="${b}" stroke-width="4"/><path d="M30 82l-4 12M50 82l-4 12M70 82l-4 12" stroke="${b}" stroke-width="5" stroke-linecap="round"/>`,
    shield: (a, b) => `<path d="M50 6 88 20c0 34-12 58-38 74C24 78 12 54 12 20Z" fill="${a}"/><path d="M50 22 54 40H72L57 51l6 18-13-11-13 11 6-18-15-11h18Z" fill="${b}"/>`,
    key: (a, b) => `<circle cx="32" cy="32" r="22" fill="none" stroke="${a}" stroke-width="10"/><path d="M47 47 88 88M70 70l10-10M80 80l8-8" stroke="${a}" stroke-width="10" stroke-linecap="round"/><circle cx="32" cy="32" r="7" fill="${b}"/>`,
    cupcake: (a, b) => `<path d="M22 54h56l-8 40H30Z" fill="${b}"/><path d="M30 54l4 40M42 54l2 40M58 54l-2 40M70 54l-4 40" stroke="${a}" stroke-width="2" opacity=".5"/><path d="M16 56c-6-14 8-22 14-20 0-14 16-22 26-16 10-6 26 4 22 18 10 0 14 12 6 18Z" fill="${a}"/><circle cx="50" cy="16" r="8" fill="#d63a3a"/>`,
    compass: (a, b) => `<circle cx="50" cy="50" r="40" fill="none" stroke="${a}" stroke-width="6"/><path d="M50 14 60 50 50 86 40 50Z" fill="${a}"/><path d="M50 14 60 50H40Z" fill="${b}"/><circle cx="50" cy="50" r="5" fill="#fff"/>`,
  };
  const NAMES = Object.keys(MOTIFS);

  function motif(name, a, b, x, y, s, rot) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-50 -50)">${MOTIFS[name](a, b)}</g>`;
  }

  // Returns { svg, motif, colors } for a title.
  function cutieMark(title, opts) {
    opts = opts || {};
    const h = hash(String(title || '').toLowerCase());
    const r = rng(h);
    const name = NAMES[h % NAMES.length];
    const pal = PALETTES[(h >>> 5) % PALETTES.length];
    const layout = (h >>> 9) % 4;
    const second = NAMES[(h >>> 13) % NAMES.length];
    let body = '';
    const tilt = () => Math.round((r() - 0.5) * 30);
    if (layout === 0) {
      body = motif(name, pal[0], pal[1], 50, 50, 0.82, tilt());
    } else if (layout === 1) {
      body = motif(name, pal[0], pal[1], 30, 62, 0.42, tilt()) + motif(name, pal[0], pal[1], 70, 62, 0.42, tilt()) + motif(name, pal[0], pal[1], 50, 28, 0.42, tilt());
    } else if (layout === 2) {
      body = motif(second, pal[1], pal[0], 66, 34, 0.42, tilt()) + motif(name, pal[0], pal[1], 42, 58, 0.66, tilt());
    } else {
      body = motif(name, pal[0], pal[1], 50, 54, 0.66, tilt()) +
        motif('sparkle', pal[1], '#ffffff', 16, 18, 0.2, 0) + motif('sparkle', pal[1], '#ffffff', 86, 24, 0.15, 0) + motif('sparkle', pal[0], '#ffffff', 84, 84, 0.18, 0);
    }
    const size = opts.size || 100;
    const svg = `<svg class="cutie" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
    return { svg, motif: name, colors: pal, inner: body };
  }

  window.Marks = { cutieMark, hash, rng, PALETTES };
})();
