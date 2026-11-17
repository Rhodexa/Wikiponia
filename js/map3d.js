/* The 3D Cutie Map: a toon-shaded table with the cross-reference graph as a hologram floating above it.
   The graph's nodes stay crisp DOM/SVG, but their positions come from this 3D scene, so they turn,
   tilt and get perspective together with the table. Loaded on demand the first time the tab opens. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TABLE_URL = new URL('../assets/models/cutie-map.glb', import.meta.url).href;
const OUTLINE = 0x1e98d5;      // Rainbow Dash's blue mane stripe, straight from the show file
const HOLO_Y = 0.40;           // height of the hologram plane (table top is ~0.2)
const HOLO_R = 0.60;           // hologram radius (table radius is 0.5)
let gltfPromise = null;

function toonRamp(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { const c = Math.round(v * 255); data.set([c, c, c, 255], i * 4); });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Averaged normals per position, so the inverted-hull outline doesn't crack along UV seams.
function smoothNormals(geom) {
  const pos = geom.attributes.position, nor = geom.attributes.normal;
  const sum = new Map();
  const key = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const s = sum.get(k) || [0, 0, 0];
    s[0] += nor.getX(i); s[1] += nor.getY(i); s[2] += nor.getZ(i);
    sum.set(k, s);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = sum.get(key(i));
    const l = Math.hypot(s[0], s[1], s[2]) || 1;
    out.set([s[0] / l, s[1] / l, s[2] / l], i * 3);
  }
  geom.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

function outlineMaterial(color, thickness) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, thickness: { value: thickness } },
    side: THREE.BackSide,
    vertexShader: `
      attribute vec3 outlineNormal;
      uniform float thickness;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + outlineNormal * thickness, 1.0);
      }`,
    fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
  });
}

// Soft light rising from the table rim: an open cylinder that fades upward.
function beam() {
  const height = HOLO_Y - 0.19 + 0.25;
  const g = new THREE.CylinderGeometry(HOLO_R * 0.98, 0.47, height, 64, 1, true);
  g.translate(0, 0.19 + height / 2, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float t;
      void main() {
        float a = pow(1.0 - vUv.y, 2.2) * 0.22;
        a *= 0.85 + 0.15 * sin(vUv.x * 60.0 + t * 1.5);
        gl_FragColor = vec4(0.55, 0.85, 1.0, a);
      }`,
  });
  return new THREE.Mesh(g, m);
}

// A faint glowing ring + disc marking the hologram plane the nodes sit on.
function holoPlane() {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HOLO_R, 72), new THREE.MeshBasicMaterial({
    color: 0x7fd4ff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(HOLO_R * 0.985, HOLO_R, 96), new THREE.MeshBasicMaterial({
    color: 0xa8e4ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  disc.rotation.x = ring.rotation.x = -Math.PI / 2;
  grp.add(disc, ring);
  grp.position.y = HOLO_Y;
  return grp;
}

function sparkles(count) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.5;
    p.set([Math.cos(a) * r, 0, Math.sin(a) * r], i * 3);
    seed[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, px: { value: 1 } },
    vertexShader: `
      attribute float seed; uniform float t; uniform float px; varying float vA;
      void main() {
        vec3 q = position;
        float life = fract(seed + t * 0.07);
        q.y = 0.2 + life * 0.55;
        q.x += sin(t * 0.7 + seed * 40.0) * 0.012;
        vA = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + seed * 3.0) * px * (1.6 / -mv.z);
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float s = max(0.0, 1.0 - (abs(d.x) + abs(d.y)) * 2.2);
        gl_FragColor = vec4(0.75, 0.9, 1.0, s * vA);
      }`,
  });
  return new THREE.Points(g, m);
}

/**
 * Mount the table into `container`. Returns { projector, destroy }.
 * projector.project(u, v, lift) maps a graph point (u, v in -1..1 of the graph's radius) onto the
 *   hologram plane and returns its screen position {x, y}, scale {s} and depth {d: 0 front .. 1 back}.
 * projector.orbit(dx, dy) / zoom(f) / reset() are driven by the map's drag/pinch gestures.
 */
export async function mount(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x40306e, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-1.2, 2.2, 1.4);
  scene.add(key);

  if (!gltfPromise) gltfPromise = new GLTFLoader().loadAsync(TABLE_URL);
  let gltf;
  try { gltf = await gltfPromise; } catch (e) { gltfPromise = null; renderer.dispose(); renderer.domElement.remove(); throw e; }

  const ramp = toonRamp([0.55, 0.8, 1.0]);
  const table = new THREE.Group();
  const model = gltf.scene.clone(true);
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });   // collect first: hull meshes get added below
  meshes.forEach((o) => {
    const tex = o.material.map;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    o.material = new THREE.MeshToonMaterial({ map: tex || null, color: tex ? 0xffffff : 0xb8c8ff, gradientMap: ramp });
    if (!o.geometry.attributes.outlineNormal) smoothNormals(o.geometry);
    o.add(new THREE.Mesh(o.geometry, outlineMaterial(OUTLINE, 0.003)));
  });
  table.add(model);
  const light = beam();
  const plane = holoPlane();
  const dust = sparkles(120);
  const holo = new THREE.Group();          // graph space: turns with the table
  table.add(light, plane, dust, holo);
  scene.add(table);

  // Orbit state, driven by gestures; `shown` eases toward it every frame.
  const DEF = { yaw: 0, tilt: 60, zoom: 1 };
  const orbit = { ...DEF };
  const shown = { ...DEF };
  let w = 1, h = 1, baseDist = 2, refDist = 2;
  const target = new THREE.Vector3(0, 0.3, 0);

  function fit() {
    w = container.clientWidth || 1; h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ht = vt * camera.aspect;
    // Hologram plus a little room for labels; on tall phones let the ring touch the edges.
    const span = camera.aspect < 0.75 ? HOLO_R * 2 * 0.94 : HOLO_R * 2 + 0.16;
    baseDist = Math.max((span / 2) / ht, (span * 0.8 / 2) / vt);
    dust.material.uniforms.px.value = renderer.getPixelRatio() * Math.min(w, h) / 300;
  }
  function place() {
    const el = THREE.MathUtils.degToRad(shown.tilt);
    const dist = baseDist / shown.zoom;
    camera.position.set(0, target.y + Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    table.rotation.y = shown.yaw;
    table.updateMatrixWorld(true);
    refDist = dist;
  }
  fit(); place();
  const ro = new ResizeObserver(() => { fit(); place(); });
  ro.observe(container);

  const v = new THREE.Vector3();
  const sizeK = () => Math.min(1, w / 420 + 0.15);
  const projector = {
    project(u, vv, lift) {
      v.set(u * HOLO_R, HOLO_Y + (lift || 0) * 0.07, vv * HOLO_R);
      holo.localToWorld(v);
      const depth = v.distanceTo(camera.position);
      v.project(camera);
      return {
        x: (v.x + 1) / 2 * w,
        y: (1 - v.y) / 2 * h,
        s: Math.min(1.5, Math.max(0.4, 0.8 * (refDist / depth) * Math.sqrt(shown.zoom) * sizeK())),
        d: Math.min(1, Math.max(0, (depth - (refDist - HOLO_R)) / (2 * HOLO_R))),
      };
    },
    orbit(dx, dy) {
      orbit.yaw += dx * 0.009;
      orbit.tilt = THREE.MathUtils.clamp(orbit.tilt + dy * 0.25, 18, 85);
    },
    zoom(f) { orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * f, 0.6, 2.6); },
    reset() { Object.assign(orbit, DEF, { yaw: Math.round(orbit.yaw / (Math.PI * 2)) * Math.PI * 2 }); },
  };

  let raf = 0, last = performance.now(), dead = false;
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = opts.motion === false ? 1 : Math.min(1, dt * 9);
    shown.yaw += (orbit.yaw - shown.yaw) * k;
    shown.tilt += (orbit.tilt - shown.tilt) * k;
    shown.zoom += (orbit.zoom - shown.zoom) * k;
    place();
    dust.material.uniforms.t.value = now / 1000;
    light.material.uniforms.t.value = now / 1000;
    renderer.render(scene, camera);
    if (opts.onFrame) opts.onFrame();
  }
  raf = requestAnimationFrame(frame);

  return {
    projector,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => { if (o.material) o.material.dispose(); });
      [light, plane.children[0], plane.children[1], dust].forEach((o) => o.geometry.dispose());
      ramp.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
