// Tekstury generowane proceduralnie w canvasie (drewno, oksyda, błysk, otoczenie).
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Szum wartości 2D (gładko interpolowany).
function makeNoise(seed) {
  const r = rng(seed);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const G = new Float32Array(256);
  for (let i = 0; i < 256; i++) G[i] = r();
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = fade(x - xi), v = fade(y - yi);
    const X = xi & 255, Y = yi & 255;
    const a = G[P[P[X] + Y]], b = G[P[P[X + 1] + Y]];
    const c = G[P[P[X] + Y + 1]], d = G[P[P[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Wysokość → mapa normalnych (różnice skończone, zawijanie na brzegach).
function normalFromHeight(h, W, H, strength) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = h[y * W + ((x - 1 + W) % W)], r = h[y * W + ((x + 1) % W)];
      const u = h[((y - 1 + H) % H) * W + x], d = h[((y + 1) % H) * W + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * W + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function wrapTex(c, aniso, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Bejcowane, lakierowane drewno (brzoza/laminat jak w kolbach AK): kolor, szorstkość, normalne.
export function woodTextures(maxAniso = 8) {
  const W = 1024, H = 512;
  const cMap = canvas(W, H), cRough = canvas(W, H);
  const a = cMap.getContext('2d'), b = cRough.getContext('2d');
  const ia = a.createImageData(W, H), ib = b.createImageData(W, H);
  const height = new Float32Array(W * H);
  const n1 = makeNoise(7), n2 = makeNoise(13), n3 = makeNoise(29), n4 = makeNoise(41);
  const light = [156, 92, 52], mid = [108, 58, 30], dark = [56, 28, 14];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const warp = (n1(x * 0.0025, y * 0.006) * 2 - 1) * 5 + (n4(x * 0.01, y * 0.02) * 2 - 1) * 1.5;
      const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.55);
      const lines = Math.pow(ring, 5);
      const pores = n3(x * 0.06, y * 1.1);
      const big = n2(x * 0.002 + 10, y * 0.008);
      const band = n4(x * 0.0012 + 3, y * 0.035);
      let t = 0.32 + lines * 0.15 + (pores - 0.5) * 0.16 + (big - 0.5) * 0.35 + (band - 0.5) * 0.45;
      t = Math.min(1, Math.max(0, t));
      const c0 = t < 0.5 ? light : mid, c1 = t < 0.5 ? mid : dark, tt = t < 0.5 ? t * 2 : t * 2 - 1;
      const i = k * 4;
      ia.data[i] = c0[0] + (c1[0] - c0[0]) * tt;
      ia.data[i + 1] = c0[1] + (c1[1] - c0[1]) * tt;
      ia.data[i + 2] = c0[2] + (c1[2] - c0[2]) * tt;
      ia.data[i + 3] = 255;
      const rv = 0.55 + lines * 0.25 + (pores - 0.5) * 0.25;
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = 255 * Math.min(1, Math.max(0, rv));
      ib.data[i + 3] = 255;
      height[k] = lines * 0.5 + pores * 0.15;
    }
  }
  a.putImageData(ia, 0, 0);
  b.putImageData(ib, 0, 0);
  const map = wrapTex(cMap, maxAniso, true);
  const roughnessMap = wrapTex(cRough, maxAniso, false);
  const normalMap = wrapTex(normalFromHeight(height, W, H, 0.9), maxAniso, false);
  for (const t of [map, roughnessMap, normalMap]) {
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.repeat.set(0.5, 0.9);
  }
  return { map, roughnessMap, normalMap };
}

// Oksydowana / fosforanowana stal: drobne przebarwienia, zmienna szorstkość i mikrostruktura.
export function metalTextures(maxAniso = 8) {
  const S = 512;
  const cMap = canvas(S, S), cRough = canvas(S, S);
  const a = cMap.getContext('2d'), b = cRough.getContext('2d');
  const ia = a.createImageData(S, S), ib = b.createImageData(S, S);
  const height = new Float32Array(S * S);
  const n = makeNoise(3), m = makeNoise(17), r = rng(5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const k = y * S + x, i = k * 4;
      const blot = n(x * 0.015, y * 0.015) * 0.6 + n(x * 0.06, y * 0.06) * 0.4;
      const grain = r();
      const v = 0.86 + 0.07 * blot + 0.04 * (grain - 0.5);
      ia.data[i] = 255 * v * 0.96;
      ia.data[i + 1] = 255 * v * 0.98;
      ia.data[i + 2] = 255 * Math.min(1, v * 1.02);
      ia.data[i + 3] = 255;
      const rv = 0.78 + 0.25 * m(x * 0.025, y * 0.025) + 0.1 * (grain - 0.5);
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = 255 * Math.min(1, rv);
      ib.data[i + 3] = 255;
      height[k] = grain * 0.6 + blot * 0.4;
    }
  }
  a.putImageData(ia, 0, 0);
  b.putImageData(ib, 0, 0);
  const map = wrapTex(cMap, maxAniso, true);
  const rough = wrapTex(cRough, maxAniso, false);
  const normal = wrapTex(normalFromHeight(height, S, S, 0.35), maxAniso, false);
  for (const t of [map, rough, normal]) t.repeat.set(2, 2);
  return { map, rough, normal };
}

// Mapa normalnych owalnego wytłoczenia na boku komory (prowadnica magazynka AKM).
export function dimpleNormal() {
  const W = 256, H = 96;
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W * 0.42), dy = (y - H / 2) / (H * 0.36);
      const d = Math.sqrt(dx * dx + dy * dy);
      h[y * W + x] = -Math.pow(Math.max(0, 1 - d * d), 1.2) * 6;
    }
  }
  const t = new THREE.CanvasTexture(normalFromHeight(h, W, H, 1));
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Podziałka na ramieniu celownika (nastawy П i 1–10).
export function sightScaleTexture() {
  const c = canvas(512, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#2a2b2e';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#d9d9d9';
  g.font = 'bold 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const marks = ['П', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  marks.forEach((t, i) => {
    const x = 470 - i * 42;
    g.fillText(t, x, 34);
    g.fillRect(x - 1, 4, 2, 9);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Błysk z lufy: biały rdzeń przechodzący w czerwień marki.
export function flashTextures() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,235,230,0.95)');
  grd.addColorStop(0.42, 'rgba(230,70,55,0.6)');
  grd.addColorStop(0.7, 'rgba(200,35,35,0.22)');
  grd.addColorStop(1, 'rgba(200,35,35,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const radial = new THREE.CanvasTexture(c);
  radial.colorSpace = THREE.SRGBColorSpace;

  const s = canvas(512, 128);
  const h = s.getContext('2d');
  const lin = h.createLinearGradient(0, 0, 512, 0);
  lin.addColorStop(0, 'rgba(255,255,255,1)');
  lin.addColorStop(0.25, 'rgba(255,200,190,0.85)');
  lin.addColorStop(0.6, 'rgba(200,35,35,0.45)');
  lin.addColorStop(1, 'rgba(200,35,35,0)');
  h.fillStyle = lin;
  h.beginPath();
  h.moveTo(0, 44);
  h.quadraticCurveTo(220, 0, 512, 64);
  h.quadraticCurveTo(220, 128, 0, 84);
  h.closePath();
  h.fill();
  const star = new THREE.CanvasTexture(s);
  star.colorSpace = THREE.SRGBColorSpace;
  return { radial, star };
}

// Maska przezroczystości podłogi: lekko przezroczysta w środku (odbicie), pełna na brzegach.
export function floorAlpha() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 34);
  grd.addColorStop(0, 'rgb(212,212,212)');
  grd.addColorStop(0.55, 'rgb(222,222,222)');
  grd.addColorStop(1, 'rgb(255,255,255)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Studyjne otoczenie do odbić w metalu: softbox, pasek boczny i czerwone panele z tyłu.
export function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(40, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide })
  ));
  const panel = (w, h, hex, k, pos) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(12, 4, 0xffffff, 3.2, [0, 12, 5]);
  panel(16, 5, 0xffffff, 0.55, [2, 2, 15]);
  panel(2.5, 12, 0xffffff, 1.4, [14, 3, 7]);
  panel(2.5, 10, 0xffffff, 0.7, [-14, 3, 8]);
  panel(16, 3, 0xc82323, 3.0, [0, 4, -14]);
  panel(3, 9, 0xc82323, 1.8, [-14, 2, -6]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  return rt.texture;
}
