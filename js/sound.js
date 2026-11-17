/* Sound effects. Silent until sounds exist: tools/process_assets.py turns new_assets/sfx/<name>.wav
   into assets/sfx/<name>.mp3 and lists them in window.ART.sfx. Every hook below just asks for a name. */
(function () {
  const LIST = (window.ART && window.ART.sfx) || {};
  let ctx = null, master = null, enabled = true;
  const buffers = new Map();   // name -> Promise<AudioBuffer|null>
  const loops = new Map();     // name -> {src, gain}

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    return ctx;
  }
  // Browsers only allow audio after a user gesture: unlock on the first tap, then preload everything.
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    Object.keys(LIST).forEach(load);
  }
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { once: true, passive: true }));

  function load(name) {
    if (!LIST[name] || !ensure()) return Promise.resolve(null);
    if (!buffers.has(name)) {
      buffers.set(name, fetch(LIST[name].src)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .catch(() => null));
    }
    return buffers.get(name);
  }

  const has = (name) => !!LIST[name];

  // play('page-turn') · play('tap-sparkle', {volume: .3, vary: .08}) · first existing name wins in an array
  async function play(names, opts = {}) {
    if (!enabled) return;
    const name = [].concat(names).find(has);
    if (!name || !ensure() || ctx.state !== 'running') return;
    const buf = await load(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (opts.vary) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * opts.vary;
    const g = ctx.createGain();
    g.gain.value = opts.volume == null ? 1 : opts.volume;
    src.connect(g).connect(master);
    src.start();
  }

  async function loop(name, opts = {}) {
    if (!enabled || !has(name) || loops.has(name) || !ensure() || ctx.state !== 'running') return;
    const buf = await load(name);
    if (!buf || loops.has(name)) return;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(opts.volume == null ? 1 : opts.volume, ctx.currentTime + 0.15);
    src.connect(g).connect(master);
    src.start();
    loops.set(name, { src, g });
  }

  function stop(name, fade = 0.25) {
    const l = loops.get(name);
    if (!l) return;
    loops.delete(name);
    l.g.gain.cancelScheduledValues(ctx.currentTime);
    l.g.gain.setValueAtTime(l.g.gain.value, ctx.currentTime);
    l.g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    l.src.stop(ctx.currentTime + fade + 0.02);
  }

  window.Sound = {
    play, loop, stop, has,
    cue(name, which) { const c = LIST[name] && LIST[name].cues; return c && c[which] != null ? c[which] : null; },
    get available() { return Object.keys(LIST).length > 0; },
    setEnabled(on) { enabled = !!on; if (!on) [...loops.keys()].forEach(n => stop(n, 0.05)); },
  };
})();
