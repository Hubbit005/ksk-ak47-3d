// Proceduralny model AK-47 (wersja z frezowaną komorą zamkową) zbudowany z brył three.js.
// Układ: oś X wzdłuż lufy (wylot w +X), Y w górę, Z w bok (prawa strona broni w +Z).
// 1 jednostka ≈ 8,5 cm. Kształty drewna i magazynka powstają jako bryły „loft”
// o zaokrąglonym przekroju, rozpięte między dwiema krzywymi obrysu.
import * as THREE from 'three';

export const LABELS = {
  receiver: 'KOMORA ZAMKOWA',
  cover: 'POKRYWA KOMORY ZAMKOWEJ',
  stock: 'KOLBA',
  grip: 'CHWYT PISTOLETOWY',
  handguard: 'ŁOŻE',
  upperHandguard: 'NAKŁADKA',
  gasTube: 'RURA GAZOWA',
  barrel: 'LUFA',
  frontSight: 'MUSZKA',
  rearSight: 'CELOWNIK',
  magazine: 'MAGAZYNEK',
  triggerGuard: 'KABŁĄK SPUSTOWY',
  trigger: 'SPUST',
  selector: 'PRZEŁĄCZNIK RODZAJU OGNIA',
  chargingHandle: 'RĄCZKA ZAMKA',
  muzzleBrake: 'HAMULEC WYLOTOWY',
  carrier: 'SUWADŁO Z TŁOKIEM',
  bolt: 'ZAMEK',
  spring: 'ZESPÓŁ SPRĘŻYNY POWROTNEJ',
  cleaningRod: 'WYCIOR',
};

// Krótkie opisy funkcji części (karta po najechaniu).
export const INFO = {
  receiver: 'Główny korpus broni. Łączy wszystkie zespoły, mieści mechanizm spustowy i prowadzi suwadło z zamkiem.',
  cover: 'Osłania wnętrze komory zamkowej przed brudem i kurzem. Przy rozkładaniu zdejmuje się ją jako pierwszą po magazynku.',
  stock: 'Drewniana kolba. Opiera się o ramię strzelca i stabilizuje broń podczas strzelania.',
  grip: 'Chwyt pistoletowy. Trzyma się go dłonią strzelającą, a palec wskazujący trafia wtedy naturalnie na spust.',
  handguard: 'Drewniane łoże pod lufą. Miejsce na dłoń podtrzymującą broń; chroni ją przed nagrzaną lufą.',
  upperHandguard: 'Drewniana nakładka na rurze gazowej. Chroni dłoń przed ciepłem i poprawia chwyt.',
  gasTube: 'Rura gazowa. Prowadzi tłok suwadła — to w niej gazy prochowe napędzają automatykę broni.',
  barrel: 'Lufa. Nadaje pociskowi kierunek i prędkość. Na lufie osadzone są blok gazowy, muszka i hamulec wylotowy.',
  frontSight: 'Muszka. Przedni element przyrządów celowniczych — razem ze szczerbinką celownika tworzy linię celowania.',
  rearSight: 'Celownik krzywkowy z suwakiem. Na podziałce ustawia się odległość do celu, a szczerbinka wyznacza linię celowania.',
  magazine: 'Magazynek pudełkowy. Przechowuje naboje i podaje je do komory. Charakterystyczny, wygięty kształt.',
  triggerGuard: 'Kabłąk spustowy. Chroni spust przed przypadkowym naciśnięciem.',
  trigger: 'Spust. Jego ściągnięcie zwalnia kurek i oddaje strzał.',
  selector: 'Przełącznik rodzaju ognia: góra — zabezpieczony, środek — ogień ciągły, dół — ogień pojedynczy.',
  chargingHandle: 'Rączka zamka. Połączona z suwadłem — służy do ręcznego przeładowania broni.',
  muzzleBrake: 'Hamulec wylotowy. Kieruje część gazów wylotowych, ograniczając podrzut i znoszenie lufy.',
  carrier: 'Suwadło z tłokiem gazowym. Pod naporem gazów cofa się, otwiera zamek i przeładowuje broń.',
  bolt: 'Zamek. Dosyła nabój do komory i zamyka ją w chwili strzału, obracając się przy ryglowaniu.',
  spring: 'Zespół sprężyny powrotnej. Po strzale przesuwa suwadło z zamkiem z powrotem do przodu.',
  cleaningRod: 'Wycior. Pręt do czyszczenia lufy, przechowywany pod lufą.',
};

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- pomocnicze bryły
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Walec wzdłuż osi X (radiusTop po stronie +X).
const cylX = (r, len, seg = 32, rTop = r) => new THREE.CylinderGeometry(rTop, r, len, seg).rotateZ(-PI / 2);
const cylY = (r, len, seg = 24, rTop = r) => new THREE.CylinderGeometry(rTop, r, len, seg);
const cylZ = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(PI / 2);

function extrude(shape, depth, bevel = 0.01, curveSegments = 24, bevelSegments = 3) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function poly(points) {
  const s = new THREE.Shape();
  s.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) s.lineTo(...points[i]);
  s.closePath();
  return s;
}

function roundRect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

const bezier = (p0, p1, p2, p3) => (s) => {
  const u = 1 - s;
  return [
    u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
    u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1],
  ];
};

// Loft: przekroje rozpięte między punktami A(s) i B(s) na płaszczyźnie XY,
// o połówce szerokości w(s) w osi Z i kształcie superelipsy o wykładniku e(s)
// (2 = elipsa, im więcej, tym bardziej „kanciasty” prostokąt z zaokrągleniami).
function loft({ A, B, w, e = () => 3, n = 40, radial = 40, caps = [true, true] }) {
  const pos = [], uv = [], idx = [];
  const R = radial, mids = [];
  let along = 0, prev = null;
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = A(s), b = B(s);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ux = (a[0] - b[0]) / 2, uy = (a[1] - b[1]) / 2;
    const hw = w(s), ex = e(s);
    if (prev) along += Math.hypot(mx - prev[0], my - prev[1]);
    prev = [mx, my];
    mids.push([mx, my]);
    const perim = 2 * (Math.hypot(ux, uy) + hw);
    for (let j = 0; j <= R; j++) {
      const t = PI / 2 + (j / R) * PI * 2;
      const c = Math.cos(t), sn = Math.sin(t);
      const fy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex);
      const fz = Math.sign(c) * Math.pow(Math.abs(c), 2 / ex);
      pos.push(mx + ux * fy, my + uy * fy, hw * fz);
      uv.push(along, (j / R) * perim);
    }
  }
  const side = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      side.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const triNormal = (a, b, c) => P(b).sub(P(a)).cross(P(c).sub(P(a)));
  {
    // orientacja ścian bocznych na zewnątrz
    const i = Math.floor(n / 2), j = Math.floor(R / 8);
    const a = i * (R + 1) + j, b = a + R + 1;
    const out = P(a).sub(new THREE.Vector3(mids[i][0], mids[i][1], 0));
    if (triNormal(a, b, a + 1).dot(out) < 0) for (let k = 0; k < side.length; k += 3) [side[k + 1], side[k + 2]] = [side[k + 2], side[k + 1]];
  }
  idx.push(...side);
  const ringCount = pos.length / 3;
  const addCap = (ring, dir) => {
    const base = pos.length / 3;
    const m = mids[ring];
    pos.push(m[0], m[1], 0);
    uv.push(m[0], m[1]);
    for (let j = 0; j <= R; j++) {
      const k = ring * (R + 1) + j;
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      uv.push(pos[k * 3], pos[k * 3 + 1]);
    }
    const tris = [];
    for (let j = 0; j < R; j++) tris.push(base, base + 1 + j, base + 2 + j);
    if (triNormal(tris[0], tris[1], tris[2]).dot(dir) < 0) for (let k = 0; k < tris.length; k += 3) [tris[k + 1], tris[k + 2]] = [tris[k + 2], tris[k + 1]];
    idx.push(...tris);
  };
  const tangent = (i0, i1) => new THREE.Vector3(mids[i1][0] - mids[i0][0], mids[i1][1] - mids[i0][1], 0);
  if (caps[0]) addCap(0, tangent(1, 0));
  if (caps[1]) addCap(n, tangent(n - 1, n));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // wygładzenie szwu (pierwszy i ostatni wierzchołek każdego pierścienia)
  const nrm = g.attributes.normal;
  for (let i = 0; i <= n; i++) {
    const a = i * (R + 1), b = a + R;
    if (b >= ringCount) break;
    const v = new THREE.Vector3(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z);
    nrm.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

// UV walca w jednostkach świata, żeby słoje biegły wzdłuż osi.
function worldUV(geo, scaleU = 1, scaleV = 1) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * scaleU, uv.getX(i) * scaleV);
  return geo;
}

// ---------------------------------------------------------------- materiały
function makeMaterials(tex) {
  const steel = {
    metalness: 0.78, map: tex.metal.map, roughnessMap: tex.metal.rough,
    normalMap: tex.metal.normal, normalScale: new THREE.Vector2(0.35, 0.35),
  };
  const metal = new THREE.MeshPhysicalMaterial({ ...steel, color: 0x5a5e65, roughness: 0.46, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  metal.userData.wear = 1;
  const dark = metal.clone();
  dark.color.set(0x3a3d42);
  dark.roughness = 0.6;
  const cover = metal.clone();
  cover.color.set(0x5c6067);
  cover.roughness = 0.42;
  cover.clearcoat = 0.25;
  const bright = metal.clone();
  bright.color.set(0x7c8086);
  bright.roughness = 0.3;
  bright.metalness = 0.9;
  const blued = metal.clone();
  blued.color.set(0x4c5057);
  blued.roughness = 0.36;
  const wood = new THREE.MeshPhysicalMaterial({
    map: tex.wood.map, roughnessMap: tex.wood.roughnessMap, normalMap: tex.wood.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.6, metalness: 0,
    clearcoat: 0.55, clearcoatRoughness: 0.28, sheen: 0.2, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a2a10),
  });
  // chwyt z brązowego tworzywa (bakelit)
  const grip = new THREE.MeshPhysicalMaterial({
    color: 0x4a2216, roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.35,
    normalMap: tex.metal.normal, normalScale: new THREE.Vector2(0.25, 0.25),
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
  const scale = new THREE.MeshStandardMaterial({ map: tex.sightScale, metalness: 0.5, roughness: 0.5 });
  return { metal, dark, cover, bright, blued, wood, grip, black, scale };
}

// Przetarcia na krawędziach: tam, gdzie normalna szybko się zmienia (fazy, zaokrąglenia),
// stal jest jaśniejsza i gładsza — jak wytarta oksyda na prawdziwej broni.
const wornMaterials = new WeakSet();
function addEdgeWear(mat) {
  if (wornMaterials.has(mat)) return;
  wornMaterials.add(mat);
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float curv = length(fwidth(vNormal)) / max(length(fwidth(vViewPosition)), 1e-5);
      float edgeWear = smoothstep(45.0, 140.0, curv);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.59, 0.62), edgeWear * 0.55);
      roughnessFactor = mix(roughnessFactor, 0.2, edgeWear);`);
  };
  mat.customProgramCacheKey = () => 'edgewear';
}

// ---------------------------------------------------------------- budowa
export function buildAK(tex) {
  const M = makeMaterials(tex);
  const root = new THREE.Group();
  root.name = 'AK-47';
  const parts = {};

  const part = (id, parent = root, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = id;
    g.userData.part = { id, label: LABELS[id] };
    g.position.set(x, y, z);
    parent.add(g);
    parts[id] = g;
    return g;
  };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const pinHead = (g, mat, x, y, len = 0.29, r = 0.022) => {
    add(g, cylZ(r, len, 18), mat, x, y, 0);
    for (const s of [-1, 1]) add(g, cylZ(r * 1.25, 0.006, 18), mat, x, y, s * len / 2);
  };

  // ======================================================== KOMORA ZAMKOWA (frezowana)
  {
    const g = part('receiver');
    const mt = M.blued.clone(), dk = M.dark.clone();
    const W = 0.135, Wi = 0.118, top = 0.07, bot = -0.42, r = 0.05;
    const u = new THREE.Shape();
    u.moveTo(-W, top);
    u.lineTo(-W, bot + r);
    u.quadraticCurveTo(-W, bot, -W + r, bot);
    u.lineTo(W - r, bot);
    u.quadraticCurveTo(W, bot, W, bot + r);
    u.lineTo(W, top);
    u.lineTo(Wi, top);
    u.lineTo(Wi, bot + 0.07);
    u.quadraticCurveTo(Wi, bot + 0.025, Wi - 0.04, bot + 0.025);
    u.lineTo(-Wi + 0.04, bot + 0.025);
    u.quadraticCurveTo(-Wi, bot + 0.025, -Wi, bot + 0.07);
    u.lineTo(-Wi, top);
    u.closePath();
    add(g, extrude(u, 3.05, 0.006, 16, 2).rotateY(PI / 2), mt, -0.375, 0, 0);
    // przedni i tylny element (wnętrze), prowadnice suwadła
    add(g, box(0.22, 0.46, 2 * Wi), mt, 1.04, -0.17, 0);
    add(g, box(0.2, 0.44, 2 * Wi), mt, -1.8, -0.18, 0);
    for (const s of [-1, 1]) add(g, box(2.4, 0.018, 0.02), dk, -0.35, 0.045, s * (Wi - 0.01));
    // tłoczona komora AKM: wytłoczenie prowadzące magazynek, nity przedniego i tylnego elementu
    const dimple = new THREE.MeshPhysicalMaterial({
      color: M.blued.color, metalness: M.blued.metalness, roughness: M.blued.roughness,
      normalMap: tex.dimple, normalScale: new THREE.Vector2(1.6, 1.6), polygonOffset: true, polygonOffsetFactor: -2,
    });
    const rivet = new THREE.SphereGeometry(0.024, 16, 8, 0, PI * 2, 0, PI / 2).rotateX(PI / 2).scale(1, 1, 0.45);
    const rivets = [[0.93, -0.04], [1.08, -0.04], [0.93, -0.32], [1.08, -0.32], [1.005, -0.18],
      [-1.72, -0.05], [-1.86, -0.05], [-1.79, -0.31], [-1.25, -0.22]];
    for (const s of [-1, 1]) {
      const d = add(g, new THREE.PlaneGeometry(0.66, 0.24), dimple, 0.47, -0.2, s * (W + 0.0012));
      if (s < 0) d.rotation.y = PI;
      d.castShadow = false;
      for (const [x, y] of rivets) {
        const r = add(g, rivet, mt, x, y, s * W);
        if (s < 0) r.rotation.y = PI;
      }
    }
    // sworznie mechanizmu spustowego i zatrzask magazynka
    pinHead(g, M.bright.clone(), -0.04, -0.3);
    pinHead(g, M.bright.clone(), -0.37, -0.3);
    pinHead(g, dk, -0.86, -0.08, 0.29, 0.018);
    pinHead(g, dk, 0.9, -0.33, 0.29, 0.018);
    const cat = poly([[0.19, -0.415], [0.252, -0.415], [0.258, -0.6], [0.236, -0.64], [0.2, -0.635], [0.205, -0.55]]);
    add(g, extrude(cat, 0.09, 0.008, 8), dk);
    pinHead(g, dk, 0.22, -0.45, 0.13, 0.014);
  }

  // ======================================================== POKRYWA KOMORY ZAMKOWEJ (punkt obrotu z przodu)
  {
    const g = part('cover', root, 1.12, 0, 0);
    const mt = M.cover.clone();
    const cy = 0.16;
    const arch = (ro, ri) => {
      const s = new THREE.Shape();
      s.moveTo(-ro, 0);
      s.lineTo(-ro, cy);
      s.absarc(0, cy, ro, PI, 0, true);
      s.lineTo(ro, 0);
      if (ri) {
        s.lineTo(ri, 0);
        s.lineTo(ri, cy);
        s.absarc(0, cy, ri, 0, PI, false);
        s.lineTo(-ri, 0);
      }
      s.closePath();
      return s;
    };
    const len = 3.0;
    add(g, extrude(arch(0.15, 0.137), len, 0.004, 40, 2).rotateY(PI / 2), mt, -len / 2, 0, 0);
    // tylna ścianka z otworem na zatrzask sprężyny
    const rear = arch(0.15);
    const hole = new THREE.Path();
    hole.absellipse(0, 0.215, 0.04, 0.035, 0, PI * 2, false);
    rear.holes.push(hole);
    add(g, extrude(rear, 0.025, 0.006, 40).rotateY(PI / 2), mt, -len + 0.02, 0, 0);
    // przetłoczenie usztywniające na górze i zawinięta krawędź z tyłu
    add(g, extrude(arch(0.153, 0.149), 0.06, 0.004, 40).rotateY(PI / 2), mt, -len + 0.06, 0, 0);
    for (let i = 0; i < 6; i++) {
      add(g, extrude(arch(0.157, 0.149), 0.028, 0.006, 40).rotateY(PI / 2), mt, -2.72 + i * 0.17, 0, 0);
    }
  }

  // ======================================================== KOLBA (drewno)
  {
    const g = part('stock');
    const wood = M.wood.clone();
    const A = (s) => [lerp(-1.86, -4.56, s), 0.055 - 0.235 * s - 0.03 * Math.sin(PI * s)];
    const B = bezier([-1.86, -0.405], [-2.3, -0.45], [-2.95, -0.92], [-4.56, -1.43]);
    const w = (s) => 0.138 + 0.1 * smooth(Math.min(1, s * 1.15));
    add(g, loft({ A, B, w, e: () => 3.2, n: 56, radial: 44 }), wood);
    // stalowa stopka z klapką
    const bp = add(g, loft({
      A: (s) => [-4.56 - 0.045 * s, -0.17], B: (s) => [-4.56 - 0.045 * s, -1.445],
      w: () => 0.243, e: () => 3.4, n: 2, radial: 44,
    }), M.dark.clone());
    add(g, box(0.006, 0.42, 0.24), M.metal.clone(), -4.608, -0.88, 0);
    for (const y of [-0.38, -1.3]) add(g, cylX(0.022, 0.012, 16), M.bright.clone(), -4.61, y, 0);
    // zaczep pasa (lewa strona)
    const sw = add(g, new THREE.TorusGeometry(0.07, 0.013, 10, 28), M.metal.clone(), -3.95, -1.06, -0.235);
    sw.rotation.y = PI / 2;
    add(g, box(0.16, 0.05, 0.02), M.metal.clone(), -3.95, -1.0, -0.232);
    // śruby mocowania na szyjce
    add(g, cylY(0.026, 0.012, 16), M.bright.clone(), -2.05, 0.03, 0);
    void bp;
  }

  // ======================================================== CHWYT PISTOLETOWY
  {
    const g = part('grip');
    const A = bezier([-0.5, -0.405], [-0.57, -0.72], [-0.66, -1.0], [-0.8, -1.3]);
    const B = bezier([-0.97, -0.405], [-1.13, -0.6], [-1.17, -0.96], [-1.23, -1.31]);
    const w = (s) => 0.1 + 0.025 * Math.sin(PI * Math.min(1, s * 1.05));
    add(g, loft({ A, B, w, e: () => 2.7, n: 32, radial: 40 }), M.grip.clone());
    // poprzeczne rowki na przedniej krawędzi chwytu
    for (let i = 0; i < 7; i++) {
      const s0 = 0.18 + i * 0.1, p = A(s0), q = B(s0);
      const groove = add(g, box(0.012, 0.012, 2 * w(s0) * 0.92), M.grip, p[0] - 0.004 + (q[0] - p[0]) * 0.02, p[1], 0);
      groove.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
    add(g, box(0.36, 0.03, 0.2), M.dark.clone(), -0.74, -0.415, 0);
  }

  // ======================================================== ŁOŻE (drewno, pod lufą)
  {
    const g = part('handguard');
    const A = (s) => [lerp(1.24, 3.0, s), 0.105 - (s > 0.94 ? (s - 0.94) / 0.06 * 0.04 : 0)];
    const B = (s) => [lerp(1.24, 3.0, s),
      -0.31 - 0.025 * Math.sin(PI * s) + (s > 0.8 ? Math.pow((s - 0.8) / 0.2, 2) * 0.13 : 0) + (s < 0.05 ? (0.05 - s) * 0.4 : 0)];
    const w = (s) => 0.16 + 0.035 * Math.sin(PI * Math.min(1, s / 0.9)) - (s > 0.92 ? (s - 0.92) * 0.4 : 0);
    add(g, loft({ A, B, w, e: () => 3.0, n: 48, radial: 44 }), M.wood.clone());
  }

  // ======================================================== LUFA (z blokiem gazowym i obejmami łoża)
  {
    const g = part('barrel');
    const mt = M.blued.clone(), dk = M.dark.clone();
    add(g, cylX(0.105, 0.5), mt, 1.35, 0, 0);
    add(g, cylX(0.082, 1.95), mt, 2.57, 0, 0);
    add(g, cylX(0.076, 1.0), mt, 4.27, 0, 0);
    add(g, cylX(0.07, 0.24), mt, 5.12, 0, 0);
    // blok gazowy (gniazdo rury u góry, pierścień na lufie, skośny kanał gazowy)
    add(g, cylX(0.115, 0.3), mt, 3.64, 0, 0);
    add(g, extrude(poly([[3.5, 0.02], [3.78, 0.02], [3.86, 0.24], [3.86, 0.3], [3.6, 0.3], [3.5, 0.16]]), 0.11, 0.012, 8), mt);
    add(g, cylX(0.098, 0.42), mt, 3.65, 0.27, 0);
    add(g, new THREE.SphereGeometry(0.098, 24, 12, 0, PI * 2, 0, PI / 2).rotateZ(-PI / 2), mt, 3.86, 0.27, 0);
    // zaczep pasa (lewa strona bloku gazowego)
    const sw = add(g, new THREE.TorusGeometry(0.06, 0.012, 10, 24), M.metal.clone(), 3.66, 0.08, -0.13);
    sw.rotation.y = PI / 2;
    // obejmy łoża
    const band = (x0, x1, top, bottom, hw) => loft({
      A: (s) => [lerp(x0, x1, s), top], B: (s) => [lerp(x0, x1, s), bottom], w: () => hw, e: () => 3.2, n: 1, radial: 44,
    });
    add(g, band(3.0, 3.08, 0.12, -0.21, 0.18), dk);
    add(g, band(1.16, 1.26, 0.14, -0.345, 0.172), dk);
    pinHead(g, M.bright.clone(), 3.04, -0.04, 0.37, 0.016);
  }

  // ======================================================== WYCIOR
  {
    const g = part('cleaningRod');
    const mt = M.bright.clone();
    add(g, cylX(0.019, 2.0, 12), mt, 4.0, -0.15, 0);
    add(g, extrude(roundRect(4.97, -0.19, 5.06, -0.11, 0.02), 0.035, 0.006, 8), mt);
  }

  // ======================================================== MUSZKA (podstawa z osłoną)
  {
    const g = part('frontSight');
    const mt = M.blued.clone(), dk = M.dark.clone();
    add(g, cylX(0.105, 0.32), mt, 4.9, 0, 0);
    add(g, extrude(poly([[4.73, -0.02], [5.07, -0.02], [5.06, 0.2], [4.98, 0.27], [4.82, 0.27], [4.74, 0.14]]), 0.1, 0.012, 8), mt);
    const ear = new THREE.Shape();
    ear.moveTo(4.8, 0.22);
    ear.lineTo(5.0, 0.22);
    ear.quadraticCurveTo(4.99, 0.42, 4.95, 0.5);
    ear.lineTo(4.86, 0.5);
    ear.quadraticCurveTo(4.82, 0.4, 4.8, 0.22);
    for (const s of [-1, 1]) add(g, extrude(ear, 0.02, 0.006, 12), mt, 0, 0, s * 0.062);
    add(g, cylY(0.036, 0.06, 20), mt, 4.9, 0.3, 0);
    add(g, cylY(0.012, 0.13, 10, 0.009), dk, 4.9, 0.39, 0);
    // dolny występ z uchwytem wyciora i zaczepem bagnetu
    add(g, extrude(poly([[4.76, -0.06], [5.04, -0.06], [5.04, -0.19], [4.96, -0.22], [4.8, -0.22], [4.76, -0.15]]), 0.08, 0.01, 8), mt);
    pinHead(g, M.bright.clone(), 4.83, 0.12, 0.13, 0.012);
  }

  // ======================================================== HAMULEC WYLOTOWY (skośnie ścięty)
  {
    const g = part('muzzleBrake');
    const mt = M.dark.clone();
    const geo = new THREE.CylinderGeometry(0.092, 0.092, 0.38, 36, 6).rotateZ(-PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.18) p.setX(i, p.getX(i) - p.getY(i) * 0.42);
    geo.computeVertexNormals();
    add(g, geo, mt, 5.43, 0, 0);
    add(g, cylX(0.094, 0.025, 36), M.metal.clone(), 5.3, 0, 0);
    add(g, box(0.11, 0.02, 0.05), M.black, 5.44, 0.085, 0);
    const bore = new THREE.Mesh(cylX(0.038, 0.004, 24), M.black);
    bore.rotation.z = Math.atan(0.42);
    bore.position.set(5.622, 0, 0);
    g.add(bore);
  }

  // ======================================================== CELOWNIK (podstawa, ramię z podziałką, suwak, szczerbinka)
  {
    const g = part('rearSight');
    const mt = M.blued.clone(), dk = M.dark.clone();
    add(g, extrude(poly([[1.1, 0.06], [1.68, 0.06], [1.68, 0.22], [1.44, 0.405], [1.1, 0.405]]), 0.2, 0.012, 8), mt);
    const leafMats = [mt, mt, M.scale, mt, mt, mt];
    const leaf = add(g, box(0.64, 0.024, 0.1), leafMats, 1.44, 0.43, 0);
    leaf.rotation.z = -0.012;
    add(g, box(0.1, 0.05, 0.13), dk, 1.62, 0.455, 0);
    for (const s of [-1, 1]) add(g, cylZ(0.018, 0.03, 12), M.bright.clone(), 1.62, 0.455, s * 0.075);
    for (const s of [-1, 1]) add(g, box(0.04, 0.06, 0.036), mt, 1.14, 0.47, s * 0.032);
    add(g, box(0.04, 0.03, 0.1), mt, 1.14, 0.45, 0);
    // zatrzask rury gazowej (prawa strona)
    const lever = poly([[1.6, 0.18], [1.7, 0.2], [1.72, 0.3], [1.64, 0.32]]);
    add(g, extrude(lever, 0.02, 0.006, 6), dk, 0, 0, 0.11);
  }

  // ======================================================== RURA GAZOWA + NAKŁADKA (punkt obrotu z przodu rury)
  {
    const g = part('gasTube', root, 3.5, 0.27, 0);
    const mt = M.blued.clone();
    add(g, cylX(0.075, 1.9), mt, 1.62 + 0.95 - 3.5, 0, 0);
    add(g, cylX(0.09, 0.08, 32), M.dark.clone(), 1.66 - 3.5, 0, 0);
    const hg = part('upperHandguard', g);
    const x0 = 1.7 - 3.5, x1 = 2.98 - 3.5;
    const taper = (s) => (s < 0.05 ? 0.86 + 0.14 * smooth(s / 0.05) : s > 0.95 ? 1 - 0.12 * smooth((s - 0.95) / 0.05) : 1);
    add(hg, loft({
      A: (s) => [lerp(x0, x1, s), 0.132 * taper(s)],
      B: (s) => [lerp(x0, x1, s), -0.118 * taper(s)],
      w: (s) => 0.127 * taper(s), e: () => 2.4, n: 40, radial: 44,
    }), M.wood.clone());
    add(hg, cylX(0.122, 0.035, 32), M.dark.clone(), x1 + 0.01, 0, 0);
  }

  // ======================================================== MAGAZYNEK (wygięty, z przetłoczeniami; punkt obrotu u góry)
  {
    const ox = 0.52, oy = -0.42;
    const g = part('magazine', root, ox, oy, 0);
    const mt = M.blued.clone(), dk = M.dark.clone();
    const C = [3.0, -0.3], R1 = 2.75, R2 = 2.2, th = 0.9;
    const pt = (r, a) => [C[0] + r * Math.cos(a) - ox, C[1] + r * Math.sin(a) - oy];
    add(g, loft({
      A: (s) => pt(R1, PI + s * th), B: (s) => pt(R2, PI + s * th),
      w: () => 0.118, e: () => 7, n: 48, radial: 40,
    }), mt);
    const rib = (ra, rb, s0, s1, hw) => loft({
      A: (s) => pt(rb, PI + lerp(s0, s1, s) * th), B: (s) => pt(ra, PI + lerp(s0, s1, s) * th),
      w: () => hw, e: () => 6, n: 36, radial: 28,
    });
    add(g, rib(2.4, 2.47, 0.07, 0.92, 0.126), mt);
    add(g, rib(2.6, 2.64, 0.1, 0.88, 0.124), mt);
    add(g, rib(2.69, 2.75, 0.04, 0.96, 0.124), mt);
    // stopka magazynka
    add(g, loft({
      A: (s) => pt(R1 + 0.02, PI + th + lerp(-0.012, 0.012, s)),
      B: (s) => pt(R2 - 0.03, PI + th + lerp(-0.012, 0.012, s)),
      w: () => 0.13, e: () => 5, n: 2, radial: 32,
    }), dk);
    // przedni zaczep i tylny występ zatrzasku
    add(g, box(0.07, 0.07, 0.18), mt, 0.83 - ox, -0.36 - oy, 0);
    add(g, box(0.05, 0.05, 0.12), mt, 0.24 - ox, -0.4 - oy, 0);
  }

  // ======================================================== KABŁĄK SPUSTOWY
  {
    const g = part('triggerGuard');
    const s = new THREE.Shape();
    s.moveTo(-0.46, -0.4);
    s.lineTo(0.18, -0.4);
    s.lineTo(0.18, -0.62);
    s.quadraticCurveTo(0.16, -0.78, -0.02, -0.78);
    s.lineTo(-0.38, -0.78);
    s.quadraticCurveTo(-0.46, -0.78, -0.46, -0.68);
    s.closePath();
    const h = new THREE.Path();
    h.moveTo(-0.42, -0.43);
    h.lineTo(-0.42, -0.67);
    h.quadraticCurveTo(-0.42, -0.74, -0.35, -0.74);
    h.lineTo(-0.03, -0.74);
    h.quadraticCurveTo(0.12, -0.74, 0.14, -0.62);
    h.lineTo(0.14, -0.43);
    h.closePath();
    s.holes.push(h);
    add(g, extrude(s, 0.08, 0.008, 24), M.blued.clone());
    add(g, extrude(roundRect(-0.48, -0.44, 0.2, -0.405, 0.015), 0.11, 0.006, 6), M.blued.clone());
  }

  // ======================================================== SPUST (punkt obrotu u góry)
  {
    const g = part('trigger', root, -0.02, -0.4, 0);
    const s = new THREE.Shape();
    s.moveTo(-0.035, 0);
    s.lineTo(0.035, 0);
    s.quadraticCurveTo(0.04, -0.16, -0.04, -0.27);
    s.quadraticCurveTo(-0.07, -0.29, -0.1, -0.27);
    s.quadraticCurveTo(-0.03, -0.16, -0.035, 0);
    s.closePath();
    add(g, extrude(s, 0.04, 0.008, 20), M.bright.clone());
  }

  // ======================================================== PRZEŁĄCZNIK RODZAJU OGNIA (prawa strona, punkt obrotu z tyłu)
  {
    const g = part('selector', root, -1.6, -0.06, 0.158);
    const mt = M.bright.clone();
    const s = new THREE.Shape();
    s.moveTo(0, -0.035);
    s.lineTo(1.18, -0.032);
    s.quadraticCurveTo(1.2, -0.06, 1.22, -0.115);
    s.lineTo(1.33, -0.105);
    s.quadraticCurveTo(1.34, -0.02, 1.32, 0.045);
    s.lineTo(0, 0.05);
    s.closePath();
    add(g, extrude(s, 0.016, 0.004, 12), mt);
    add(g, box(1.0, 0.016, 0.012), mt, 0.6, 0.008, 0.012);
    for (const x of [1.25, 1.28, 1.31]) add(g, box(0.012, 0.07, 0.01), mt, x, -0.06, 0.012);
    add(g, cylZ(0.062, 0.03, 32), mt, 0, 0, 0);
    add(g, cylZ(0.022, 0.034, 16), M.dark.clone(), 0, 0, 0.003);
  }

  // ======================================================== SUWADŁO Z TŁOKIEM (+ zamek i rączka zamka)
  {
    const g = part('carrier');
    const mt = M.metal.clone(), br = M.bright.clone(), dk = M.dark.clone();
    const prof = poly([[-0.95, -0.03], [0.62, -0.03], [0.74, 0.04], [0.76, 0.31], [0.55, 0.31], [0.5, 0.17], [-0.95, 0.17]]);
    add(g, extrude(prof, 0.15, 0.012, 8), mt);
    add(g, cylX(0.07, 1.3), mt, -0.3, 0.12, 0);
    add(g, cylX(0.04, 2.55, 20), br, 2.0, 0.27, 0);
    add(g, cylX(0.07, 0.2), br, 3.36, 0.27, 0);
    for (const x of [3.31, 3.38, 3.43]) add(g, cylX(0.072, 0.012), dk, x, 0.27, 0);

    const bolt = part('bolt', g, 0.62, 0, 0);
    const bm = M.bright.clone();
    add(bolt, cylX(0.06, 0.5), bm, 0, 0, 0);
    for (const s of [-1, 1]) add(bolt, box(0.07, 0.045, 0.05), bm, 0.27, 0, s * 0.055);
    add(bolt, box(0.18, 0.02, 0.03), dk, 0.18, 0.055, 0.02);
    add(bolt, cylY(0.025, 0.06, 12), bm, -0.08, 0.07, 0);
    add(bolt, cylX(0.02, 0.12, 10), bm, -0.3, 0, 0);

    const ch = part('chargingHandle', g, 0.6, 0.03, 0);
    const cm = M.metal.clone();
    add(ch, box(0.1, 0.06, 0.26), cm, 0, 0, 0.2);
    const knob = add(ch, new THREE.SphereGeometry(0.075, 28, 18), cm, 0, 0.02, 0.36);
    knob.scale.set(1.1, 0.95, 1.2);
    for (const z of [0.33, 0.37]) add(ch, cylZ(0.083, 0.008, 28), dk, 0, 0.02, z);
  }

  // ======================================================== ZESPÓŁ SPRĘŻYNY POWROTNEJ (punkt bazowy z tyłu)
  let coil;
  {
    const g = part('spring', root, -1.85, 0.12, 0);
    const br = M.bright.clone(), mt = M.metal.clone();
    add(g, cylX(0.016, 0.98, 10), br, 0.49, 0, 0);
    class Helix extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = t * 26 * 2 * PI;
        return target.set(t, Math.cos(a) * 0.034, Math.sin(a) * 0.034);
      }
    }
    coil = add(g, new THREE.TubeGeometry(new Helix(), 520, 0.007, 6, false), br);
    coil.scale.x = 0.9;
    add(g, box(0.09, 0.12, 0.12), mt, -0.03, 0, 0);
    add(g, cylX(0.034, 0.07, 20), mt, -0.06, 0.095, 0);
  }

  root.traverse((o) => {
    if (o.isMesh && o.material.userData && o.material.userData.wear) addEdgeWear(o.material);
    if (o.userData.part) {
      o.userData.basePos = o.position.clone();
      o.userData.baseRot = o.rotation.clone();
    }
  });

  return { root, parts, coil, muzzle: new THREE.Vector3(5.66, 0, 0) };
}
