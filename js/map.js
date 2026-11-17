/* The Cutie Map: an interactive, pannable cross-reference graph. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function CutieMap(container, { onTap }) {
    this.container = container;
    this.onTap = onTap;
    this.nodes = new Map();   // id -> node
    this.edges = new Map();   // "a\u0000b" -> {a,b,kind}
    this.view = { x: 0, y: 0, k: 1 };
    this.alpha = 0;
    this._build();
  }

  CutieMap.prototype._build = function () {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'map-svg');
    svg.innerHTML = `
      <defs>
        <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--map-glow)" stop-opacity=".9"/>
          <stop offset="100%" stop-color="var(--map-glow)" stop-opacity="0"/>
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <g class="map-world"><g class="map-stems"></g><g class="map-edges"></g><g class="map-nodes"></g></g>`;
    this.container.appendChild(svg);
    this.svg = svg;
    this.world = svg.querySelector('.map-world');
    this.gEdges = svg.querySelector('.map-edges');
    this.gStems = svg.querySelector('.map-stems');
    this.gNodes = svg.querySelector('.map-nodes');
    this._bindGestures();
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.container);
  };

  CutieMap.prototype.destroy = function () {
    this._dead = true;
    this._ro && this._ro.disconnect();
  };

  CutieMap.prototype._resize = function () {
    const r = this.container.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    this._apply();
  };

  CutieMap.prototype._apply = function () {
    if (this.projector) { this.world.removeAttribute('transform'); return; }
    const { x, y, k } = this.view;
    this.world.setAttribute('transform', `translate(${this.w / 2 + x} ${this.h / 2 + y}) scale(${k})`);
  };

  CutieMap.prototype.addNode = function (id, kind, near) {
    let n = this.nodes.get(id);
    if (n) {
      const rank = { link: 0, trail: 1, expanded: 2, center: 3 };
      if (rank[kind] > rank[n.kind]) { n.kind = kind; n.dirty = true; }
      return n;
    }
    const base = near ? this.nodes.get(near) : null;
    const a = Math.random() * Math.PI * 2;
    const d = base ? 60 + Math.random() * 40 : 20 + Math.random() * 200;
    n = { id, kind, x: (base ? base.x : 0) + Math.cos(a) * d, y: (base ? base.y : 0) + Math.sin(a) * d,
          z: Math.max(0, (base ? base.z || 0 : 0) + (Math.random() - 0.3) * 60), vx: 0, vy: 0, vz: 0, parents: new Set(), dirty: true };
    this.nodes.set(id, n);
    return n;
  };

  CutieMap.prototype.addEdge = function (a, b, kind) {
    if (a === b) return;
    const k = a < b ? a + '\u0000' + b : b + '\u0000' + a;
    const e = this.edges.get(k);
    if (e) { if (kind === 'trail') e.kind = 'trail'; return; }
    this.edges.set(k, { a, b, kind });
    if (kind === 'xref') this.nodes.get(b) && this.nodes.get(b).parents.add(a);
  };

  CutieMap.prototype.isShared = function (n) { return n.parents.size >= 2; };

  CutieMap.prototype.setKind = function (id, kind) {
    const n = this.nodes.get(id);
    if (n && n.kind !== kind) { n.kind = kind; n.dirty = true; }
  };

  CutieMap.prototype.removeEdge = function (a, b) {
    const k = a < b ? a + '\u0000' + b : b + '\u0000' + a;
    const e = this.edges.get(k);
    if (!e) return;
    if (e.el) e.el.remove();
    this.edges.delete(k);
    for (const [p, c] of [[e.a, e.b], [e.b, e.a]]) {
      const n = this.nodes.get(c);
      if (n && n.parents.delete(p)) n.dirty = true;
    }
  };

  CutieMap.prototype.removeNode = function (id) {
    const n = this.nodes.get(id);
    if (!n) return;
    for (const e of Array.from(this.edges.values())) if (e.a === id || e.b === id) this.removeEdge(e.a, e.b);
    if (n.el) n.el.remove();
    if (n.stem) n.stem.remove();
    this.nodes.delete(id);
    this._orderKey = null;
  };

  CutieMap.prototype.render = function () {
    // edges
    this.gEdges.textContent = '';
    for (const e of this.edges.values()) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('class', 'edge edge-' + e.kind);
      e.el = line;
      this.gEdges.appendChild(line);
    }
    // nodes
    for (const n of this.nodes.values()) {
      const sh = this.isShared(n);
      if (n.el && !n.dirty && n._sh === sh) continue;
      n._sh = sh;
      if (n.el) n.el.remove();
      const g = document.createElementNS(NS, 'g');
      const r = n.kind === 'center' ? 38 : n.kind === 'expanded' ? 28 : n.kind === 'trail' ? 26 : 20;
      n.r = r;
      const shared = this.isShared(n);
      g.setAttribute('class', `node node-${n.kind}${shared ? ' node-shared' : ''}`);
      g.setAttribute('data-node', n.id);
      const mk = Marks.cutieMark(n.id);
      const label = n.id.length > 22 ? n.id.slice(0, 20) + '…' : n.id;
      g.innerHTML = `
        <circle class="halo" r="${r * 1.9}" fill="url(#mapGlow)"/>
        <circle class="disc" r="${r}"/>
        <g transform="translate(${-r * 0.78} ${-r * 0.78}) scale(${r * 1.56 / 100})">${mk.inner}</g>
        <text class="label" y="${r + 15}" text-anchor="middle"></text>`;
      g.querySelector('text').textContent = label;
      this.gNodes.appendChild(g);
      n.el = g; n.dirty = false; n._ls = null; n._op = null; n._far = null;
      if (!n.stem) {
        n.stem = document.createElementNS(NS, 'line');
        n.stem.setAttribute('class', 'stem');
        this.gStems.appendChild(n.stem);
      }
    }
    this._needs3d = true; this._orderKey = null;
    this.kick(1);
  };

  // Resting heights above the hologram plane (graph units): you are on top, your trail and
  // cross-referenced books float in the middle, plain links sit low. Repulsion spreads the rest.
  const LAYER = { center: 140, expanded: 95, trail: 70, link: 18 };

  CutieMap.prototype.kick = function (a) {
    const wasIdle = this.alpha < 0.01;
    this.alpha = Math.max(this.alpha, a || 0.6);
    if (wasIdle) requestAnimationFrame(() => this._tick());
  };

  CutieMap.prototype._tick = function () {
    if (this._dead) return;
    const nodes = Array.from(this.nodes.values());
    const alpha = this.alpha;
    const deep = !!this.projector;   // 3D: nodes also spread vertically (z), in layers by kind
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, dz = deep ? b.z - a.z : 0;
        let d2 = dx * dx + dy * dy + dz * dz || 0.01;
        const min = (a.r + b.r + 34) * (deep ? 0.75 : 1);
        const f = (2600 / d2) * alpha + (d2 < min * min ? (min - Math.sqrt(d2)) * 0.08 : 0);
        const d = Math.sqrt(d2);
        dx /= d; dy /= d; dz /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        if (deep) { a.vz -= dz * f; b.vz += dz * f; }
      }
    }
    // springs
    for (const e of this.edges.values()) {
      const a = this.nodes.get(e.a), b = this.nodes.get(e.b);
      if (!a || !b) continue;
      const len = e.kind === 'trail' ? 150 : (a.kind === 'center' || b.kind === 'center') ? 130 : 100;
      const dx = b.x - a.x, dy = b.y - a.y, dz = deep ? b.z - a.z : 0;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const f = (d - len) * 0.02 * alpha;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      if (deep) { a.vz += dz / d * f; b.vz -= dz / d * f; }
    }
    for (const n of nodes) {
      if (n.kind === 'center') { n.vx += -n.x * 0.05; n.vy += -n.y * 0.05; }
      else { n.vx += -n.x * 0.002 * alpha; n.vy += -n.y * 0.002 * alpha; }
      if (deep) n.vz += ((LAYER[n.kind] || 0) - n.z) * 0.012;
      if (n === this._drag) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.6; n.vy *= 0.6; n.vz *= 0.6;
      n.x += n.vx; n.y += n.vy;
      n.z = deep ? Math.max(0, n.z + n.vz) : n.z;
    }
    if (!this.projector) this._draw();   // in 3D, the scene's frame loop draws (frame3d)
    this.alpha *= 0.985;
    if (this.alpha > 0.01) requestAnimationFrame(() => this._tick());
  };

  // 3D mode: positions come from the table scene (see map3d.js), which calls _draw every frame.
  CutieMap.prototype.setProjector = function (p) {
    this.projector = p;
    this._frame = 0;
    this.svg.classList.add('holo');
    this._apply();
    this._needs3d = true;
    this.kick(0.8);   // let the layout grow into the third dimension
  };

  // Called by the 3D scene every frame: redraw only if the camera moved, the layout is settling,
  // or the graph is still easing to its new size. Idle frames touch no DOM at all.
  CutieMap.prototype.frame3d = function (moved) {
    if (moved || this.alpha > 0.01 || this._fitEasing || this._needs3d) { this._needs3d = false; this._draw3d(); }
  };

  CutieMap.prototype._draw3d = function () {
    const P = this.projector;
    let maxR = 0;
    for (const n of this.nodes.values()) maxR = Math.max(maxR, Math.hypot(n.x, n.y) + (n.r || 20));
    const goal = Math.max(160, maxR);
    this.fitR = this.fitR ? this.fitR + (goal - this.fitR) * 0.08 : goal;
    this._fitEasing = Math.abs(goal - this.fitR) > 0.5;
    for (const n of this.nodes.values()) {
      const u = n.x / this.fitR, v = n.y / this.fitR;
      const p = P.project(u, v, (n.z || 0) / this.fitR);
      n.p = p;
      if (n.stem) {
        const b = P.project(u, v, 0);
        n.stem.setAttribute('x1', p.x.toFixed(1)); n.stem.setAttribute('y1', p.y.toFixed(1));
        n.stem.setAttribute('x2', b.x.toFixed(1)); n.stem.setAttribute('y2', b.y.toFixed(1));
      }
      if (n.el) {
        n.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.s.toFixed(3)})`);
        // labels keep a readable on-screen size however small the mark gets
        const ls = Math.round((n.kind === 'center' ? 13 : 11) / p.s);
        if (n._ls !== ls) { const tx = n.el.querySelector('.label'); tx.style.fontSize = ls + 'px'; tx.setAttribute('y', n.r + ls * 1.1); n._ls = ls; }
        const op = (1 - 0.55 * p.d).toFixed(2);
        if (n._op !== op) { n.el.style.opacity = op; n._op = op; }
        const far = p.d > 0.5;                      // back-side labels hide until you turn the map
        if (n._far !== far) { n.el.classList.toggle('far', far); n._far = far; }
      }
    }
    for (const e of this.edges.values()) {
      const a = this.nodes.get(e.a), b = this.nodes.get(e.b);
      if (!a || !b || !e.el || !a.p || !b.p) continue;
      e.el.setAttribute('x1', a.p.x.toFixed(1)); e.el.setAttribute('y1', a.p.y.toFixed(1));
      e.el.setAttribute('x2', b.p.x.toFixed(1)); e.el.setAttribute('y2', b.p.y.toFixed(1));
      const op = (1 - 0.6 * Math.max(a.p.d, b.p.d)).toFixed(2);
      if (e._op !== op) { e.el.style.opacity = op; e._op = op; }
    }
    // Painter's order: far nodes first, so near ones overlap them.
    if (this._frame++ % 10 === 0) {
      const order = Array.from(this.nodes.values()).filter(n => n.el && n.p).sort((a, b) => b.p.d - a.p.d);
      const key = order.map(n => n.id).join('\u0000');
      if (key !== this._orderKey) { this._orderKey = key; for (const n of order) this.gNodes.appendChild(n.el); }
    }
  };

  CutieMap.prototype._draw = function () {
    if (this.projector) return this._draw3d();
    for (const e of this.edges.values()) {
      const a = this.nodes.get(e.a), b = this.nodes.get(e.b);
      if (!a || !b || !e.el) continue;
      e.el.setAttribute('x1', a.x.toFixed(1)); e.el.setAttribute('y1', a.y.toFixed(1));
      e.el.setAttribute('x2', b.x.toFixed(1)); e.el.setAttribute('y2', b.y.toFixed(1));
    }
    for (const n of this.nodes.values()) if (n.el) n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
  };

  CutieMap.prototype.focus = function (id) {
    const n = this.nodes.get(id);
    if (!n) return;
    this.view.x = -n.x * this.view.k; this.view.y = -n.y * this.view.k;
    this._apply();
  };

  CutieMap.prototype._bindGestures = function () {
    const pts = new Map();
    let start = null, moved = false, pinch = null;
    const svg = this.svg;
    svg.addEventListener('pointerdown', (ev) => {
      svg.setPointerCapture(ev.pointerId);
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      moved = false;
      if (pts.size === 1) {
        start = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, vx: this.view.x, vy: this.view.y, target: ev.target.closest('[data-node]') };
      } else if (pts.size === 2) {
        const [p1, p2] = Array.from(pts.values());
        pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), k: this.view.k, vx: this.view.x, vy: this.view.y };
      }
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 2 && pinch && this.projector) {
        const [p1, p2] = Array.from(pts.values());
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        this.projector.zoom(d / (pinch.last || pinch.d)); pinch.last = d; moved = true;
      } else if (start && this.projector && pts.size === 1) {
        const dx = ev.clientX - start.lx, dy = ev.clientY - start.ly;
        if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 6) moved = true;
        if (moved) this.projector.orbit(dx, dy);
        start.lx = ev.clientX; start.ly = ev.clientY;
      } else if (pts.size === 2 && pinch) {
        const [p1, p2] = Array.from(pts.values());
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const k = Math.min(3, Math.max(0.3, pinch.k * d / pinch.d));
        this.view.x = pinch.vx * k / pinch.k; this.view.y = pinch.vy * k / pinch.k; this.view.k = k;
        moved = true; this._apply();
      } else if (start) {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (moved) { this.view.x = start.vx + dx; this.view.y = start.vy + dy; this._apply(); }
      }
    });
    const end = (ev) => {
      if (!pts.has(ev.pointerId)) return;
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        if (!moved && start && start.target) this.onTap(start.target.getAttribute('data-node'));
        start = null;
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      if (this.projector) { this.projector.zoom(Math.exp(-ev.deltaY * 0.0015)); return; }
      const k = Math.min(3, Math.max(0.3, this.view.k * Math.exp(-ev.deltaY * 0.0015)));
      this.view.x *= k / this.view.k; this.view.y *= k / this.view.k; this.view.k = k;
      this._apply();
    }, { passive: false });
  };

  CutieMap.prototype.zoom = function (f) {
    if (this.projector) { this.projector.zoom(f); return; }
    const k = Math.min(3, Math.max(0.3, this.view.k * f));
    this.view.x *= k / this.view.k; this.view.y *= k / this.view.k; this.view.k = k;
    this._apply();
  };

  window.CutieMap = CutieMap;
})();
