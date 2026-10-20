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

export function woodTexture(maxAniso = 8) {
  const W = 1024, H = 512;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n1 = makeNoise(7), n2 = makeNoise(13), n3 = makeNoise(29);
  const light = [150, 78, 38], dark = [82, 38, 17];
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const warp = (n1(x * 0.004, y * 0.012) * 2 - 1) * 22 + (n1(x * 0.013 + 40, y * 0.03) * 2 - 1) * 5;
      const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.34 + n2(x * 0.002, y * 0.004) * 7);
      const r4 = ring * ring * ring * ring * (0.45 + 0.55 * n1(x * 0.006 + 7, y * 0.02));
      const pores = n3(x * 0.035, y * 0.9);
      const big = n2(x * 0.0016 + 10, y * 0.005 + 3);
      let t = r4 * 0.32 + pores * 0.2 + big * 0.5 - 0.02;
      t = Math.min(1, Math.max(0, t));
      img.data[i++] = light[0] + (dark[0] - light[0]) * t;
      img.data[i++] = light[1] + (dark[1] - light[1]) * t;
      img.data[i++] = light[2] + (dark[2] - light[2]) * t;
      img.data[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // UV-ki w jednostkach świata: 1 tekstura ≈ 2 x 1.35 jednostki
  tex.repeat.set(0.5, 0.74);
  tex.anisotropy = maxAniso;
  return tex;
}

// Lekka oksyda: drobne przebarwienia i zmienna szorstkość.
export function metalTextures(maxAniso = 8) {
  const S = 512;
  const cMap = canvas(S, S), cRough = canvas(S, S);
  const a = cMap.getContext('2d'), b = cRough.getContext('2d');
  const ia = a.createImageData(S, S), ib = b.createImageData(S, S);
  const n = makeNoise(3), m = makeNoise(17), r = rng(5);
  let i = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const blot = n(x * 0.02, y * 0.02) * 0.6 + n(x * 0.07, y * 0.07) * 0.4;
      const grain = r();
      const v = 0.84 + 0.08 * blot + 0.05 * (grain - 0.5);
      ia.data[i] = 255 * v * 0.95;
      ia.data[i + 1] = 255 * v * 0.97;
      ia.data[i + 2] = 255 * Math.min(1, v * 1.02);
      ia.data[i + 3] = 255;
      const rv = 0.75 + 0.3 * m(x * 0.03, y * 0.03) + 0.08 * (grain - 0.5);
      ib.data[i] = ib.data[i + 1] = ib.data[i + 2] = 255 * Math.min(1, rv);
      ib.data[i + 3] = 255;
      i += 4;
    }
  }
  a.putImageData(ia, 0, 0);
  b.putImageData(ib, 0, 0);
  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  const rough = new THREE.CanvasTexture(cRough);
  for (const t of [map, rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
  }
  return { map, rough };
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
