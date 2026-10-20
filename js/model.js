// Proceduralny, stylizowany model AK-47 zbudowany z prymitywów three.js.
// Układ: oś X wzdłuż lufy (wylot w +X), Y w górę, Z w bok (prawa strona broni w +Z).
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

const PI = Math.PI;

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Walec wzdłuż osi X (radiusTop po stronie +X).
const cylX = (r, len, seg = 24, rTop = r) => new THREE.CylinderGeometry(rTop, r, len, seg).rotateZ(-PI / 2);
const cylZ = (r, len, seg = 20) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(PI / 2);

function extrude(shape, depth, bevel = 0.02, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// UV walca w jednostkach świata, żeby słoje biegły wzdłuż osi.
function worldUVCylinder(geo, len, r) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, v * len, u * 2 * PI * r);
  }
  return geo;
}

function makeMaterials(tex) {
  const metal = new THREE.MeshStandardMaterial({
    color: 0x585b61, metalness: 0.8, roughness: 0.46,
    map: tex.metal.map, roughnessMap: tex.metal.rough,
  });
  const dark = metal.clone();
  dark.color.set(0x34363a);
  dark.roughness = 0.58;
  const cover = metal.clone();
  cover.color.set(0x4d5056);
  cover.roughness = 0.38;
  const bright = metal.clone();
  bright.color.set(0x84878d);
  bright.roughness = 0.32;
  const wood = new THREE.MeshPhysicalMaterial({
    map: tex.wood, roughness: 0.52, metalness: 0,
    clearcoat: 0.3, clearcoatRoughness: 0.38, envMapIntensity: 0.7,
  });
  return { metal, dark, cover, bright, wood };
}

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

  // ---------- KOMORA ZAMKOWA (otwarta od góry, żeby po zdjęciu pokrywy było widać wnętrze)
  {
    const g = part('receiver');
    const mt = M.metal.clone(), dk = M.dark.clone();
    add(g, box(3.05, 0.06, 0.28), mt, -0.375, -0.39, 0);
    for (const s of [-1, 1]) {
      add(g, box(3.05, 0.5, 0.03), mt, -0.375, -0.17, s * 0.125);
      add(g, box(0.72, 0.13, 0.006), dk, 0.44, -0.17, s * 0.142);
      for (const [x, y] of [[-0.02, -0.3], [-0.36, -0.3], [-1.25, -0.22], [0.0, -0.05]]) {
        add(g, cylZ(0.024, 0.012, 14), dk, x, y, s * 0.145);
      }
    }
    add(g, box(0.2, 0.5, 0.28), mt, 1.05, -0.17, 0);
    add(g, box(0.2, 0.48, 0.28), mt, -1.8, -0.18, 0);
  }

  // ---------- POKRYWA KOMORY ZAMKOWEJ (punkt obrotu z przodu)
  {
    const g = part('cover', root, 1.12, 0, 0);
    const mt = M.cover.clone();
    const arch = (ro, ri) => {
      const s = new THREE.Shape();
      s.moveTo(-ro, 0);
      s.lineTo(-ro, 0.17);
      s.absarc(0, 0.17, ro, PI, 0, true);
      s.lineTo(ro, 0);
      if (ri) {
        s.lineTo(ri, 0);
        s.lineTo(ri, 0.17);
        s.absarc(0, 0.17, ri, 0, PI, false);
        s.lineTo(-ri, 0);
      }
      s.closePath();
      return s;
    };
    const len = 3.0;
    add(g, extrude(arch(0.165, 0.14), len, 0, 32).rotateY(PI / 2), mt, -len / 2, 0, 0);
    add(g, extrude(arch(0.165), 0.03, 0, 32).rotateY(PI / 2), mt, -len + 0.015, 0, 0);
    add(g, extrude(arch(0.165), 0.03, 0, 32).rotateY(PI / 2), mt, -0.015, 0, 0);
    for (const x of [-2.62, -2.42, -2.22]) {
      add(g, extrude(arch(0.174, 0.16), 0.05, 0, 32).rotateY(PI / 2), mt, x, 0, 0);
    }
  }

  // ---------- KOLBA (drewno)
  {
    const g = part('stock');
    const s = new THREE.Shape();
    s.moveTo(-1.88, 0.04);
    s.lineTo(-2.3, 0.0);
    s.quadraticCurveTo(-3.4, -0.1, -4.52, -0.2);
    s.lineTo(-4.52, -1.26);
    s.lineTo(-4.3, -1.25);
    s.quadraticCurveTo(-3.0, -0.95, -2.35, -0.62);
    s.quadraticCurveTo(-2.05, -0.47, -1.88, -0.4);
    s.closePath();
    add(g, extrude(s, 0.26, 0.045, 32), M.wood.clone());
    add(g, box(0.05, 1.12, 0.36), M.dark.clone(), -4.59, -0.73, 0);
  }

  // ---------- CHWYT PISTOLETOWY
  {
    const g = part('grip');
    const s = new THREE.Shape();
    s.moveTo(-0.94, -0.4);
    s.lineTo(-0.5, -0.4);
    s.lineTo(-0.58, -0.6);
    s.quadraticCurveTo(-0.7, -0.95, -0.82, -1.25);
    s.lineTo(-1.22, -1.28);
    s.quadraticCurveTo(-1.08, -0.85, -0.94, -0.4);
    s.closePath();
    add(g, extrude(s, 0.2, 0.04, 24), M.wood.clone());
  }

  // ---------- ŁOŻE (drewno, pod lufą)
  {
    const g = part('handguard');
    const s = new THREE.Shape();
    s.moveTo(1.22, 0.1);
    s.lineTo(3.0, 0.1);
    s.lineTo(3.02, -0.12);
    s.quadraticCurveTo(3.0, -0.26, 2.85, -0.3);
    s.lineTo(1.6, -0.3);
    s.quadraticCurveTo(1.36, -0.36, 1.22, -0.34);
    s.closePath();
    add(g, extrude(s, 0.3, 0.04, 24), M.wood.clone());
  }

  // ---------- LUFA (z blokiem gazowym i obejmami łoża)
  {
    const g = part('barrel');
    const mt = M.metal.clone(), dk = M.dark.clone();
    add(g, cylX(0.078, 4.15), mt, 3.175, 0, 0);
    add(g, cylX(0.12, 0.45), mt, 1.32, 0, 0);
    add(g, cylX(0.12, 0.3), mt, 3.63, 0, 0);
    add(g, box(0.26, 0.27, 0.13), mt, 3.63, 0.135, 0);
    add(g, cylX(0.1, 0.36), mt, 3.64, 0.27, 0);
    add(g, new THREE.SphereGeometry(0.1, 20, 10, 0, PI * 2, 0, PI / 2).rotateZ(-PI / 2), mt, 3.82, 0.27, 0);
    add(g, box(0.07, 0.48, 0.42), dk, 3.05, -0.1, 0);
    add(g, box(0.06, 0.52, 0.42), dk, 1.19, -0.1, 0);
  }

  // ---------- WYCIOR
  {
    const g = part('cleaningRod');
    const mt = M.bright.clone();
    add(g, cylX(0.02, 2.05, 12), mt, 3.95, -0.15, 0);
    add(g, cylX(0.032, 0.07, 14), mt, 5.0, -0.15, 0);
  }

  // ---------- MUSZKA
  {
    const g = part('frontSight');
    const mt = M.metal.clone(), dk = M.dark.clone();
    add(g, cylX(0.11, 0.3), mt, 4.9, 0, 0);
    add(g, box(0.2, 0.22, 0.12), mt, 4.9, 0.17, 0);
    for (const s of [-1, 1]) add(g, box(0.16, 0.2, 0.025), mt, 4.9, 0.37, s * 0.06);
    add(g, new THREE.CylinderGeometry(0.014, 0.016, 0.16, 10), dk, 4.9, 0.36, 0);
    add(g, box(0.22, 0.1, 0.1), mt, 4.88, -0.12, 0);
  }

  // ---------- HAMULEC WYLOTOWY (skośnie ścięty)
  {
    const g = part('muzzleBrake');
    const mt = M.dark.clone();
    const geo = new THREE.CylinderGeometry(0.095, 0.095, 0.36, 28, 4).rotateZ(-PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) > 0.17) p.setX(i, p.getX(i) - p.getY(i) * 0.4);
    }
    geo.computeVertexNormals();
    add(g, geo, mt, 5.43, 0, 0);
    add(g, box(0.12, 0.02, 0.05), M.metal.clone(), 5.38, 0.09, 0);
    const bore = new THREE.Mesh(cylX(0.04, 0.004, 20), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    bore.rotation.z = Math.atan(0.4);
    bore.position.set(5.613, 0, 0);
    g.add(bore);
  }

  // ---------- CELOWNIK
  {
    const g = part('rearSight');
    const mt = M.metal.clone(), dk = M.dark.clone();
    add(g, box(0.5, 0.38, 0.22), mt, 1.37, 0.23, 0);
    const leaf = add(g, box(0.72, 0.025, 0.11), mt, 1.62, 0.435, 0);
    leaf.rotation.z = 0.025;
    add(g, box(0.09, 0.05, 0.15), dk, 1.72, 0.46, 0);
    for (const s of [-1, 1]) add(g, box(0.04, 0.05, 0.035), mt, 1.29, 0.47, s * 0.035);
  }

  // ---------- RURA GAZOWA + NAKŁADKA (punkt obrotu z przodu rury)
  {
    const g = part('gasTube', root, 3.5, 0.27, 0);
    const mt = M.metal.clone();
    add(g, cylX(0.075, 1.95), mt, 1.55 + 1.95 / 2 - 3.5, 0, 0);
    add(g, cylX(0.147, 0.05, 28), M.dark.clone(), 1.63 - 3.5, 0, 0);
    const hg = part('upperHandguard', g);
    const wood = add(hg, worldUVCylinder(cylX(0.14, 1.36, 32, 0.13), 1.36, 0.14), M.wood.clone(), 2.3 - 3.5, 0, 0);
    wood.scale.z = 0.92;
    add(hg, cylX(0.137, 0.04, 28), M.dark.clone(), 2.99 - 3.5, 0, 0);
  }

  // ---------- MAGAZYNEK (wygięty; punkt obrotu u góry, w gnieździe)
  {
    const g = part('magazine', root, 0.52, -0.42, 0);
    const mt = M.dark.clone(), mt2 = M.metal.clone();
    const C = [3.0, -0.3], R1 = 2.75, R2 = 2.2, th = 0.66;
    const pt = (r, a) => [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
    const s = new THREE.Shape();
    s.moveTo(...pt(R1, PI));
    s.absarc(C[0], C[1], R1, PI, PI + th, false);
    s.lineTo(...pt(R2, PI + th));
    s.absarc(C[0], C[1], R2, PI + th, PI, true);
    s.closePath();
    add(g, extrude(s, 0.2, 0.025, 48).translate(-0.52, 0.42, 0), mt);
    const rib = (ra, rb, a0, a1, d) => {
      const r = new THREE.Shape();
      r.moveTo(...pt(rb, PI + a0));
      r.absarc(C[0], C[1], rb, PI + a0, PI + a1, false);
      r.lineTo(...pt(ra, PI + a1));
      r.absarc(C[0], C[1], ra, PI + a1, PI + a0, true);
      r.closePath();
      return extrude(r, d, 0.008, 40).translate(-0.52, 0.42, 0);
    };
    add(g, rib(2.44, 2.51, 0.07, 0.58, 0.26), mt);
    add(g, rib(2.63, 2.67, 0.12, 0.5, 0.26), mt);
    const rb = pt(R1, PI + th), fb = pt(R2, PI + th);
    const plate = add(g, box(0.62, 0.06, 0.27), mt2, (rb[0] + fb[0]) / 2 - 0.52, (rb[1] + fb[1]) / 2 + 0.42 - 0.02, 0);
    plate.rotation.z = th;
    add(g, box(0.08, 0.08, 0.2), mt2, 0.82 - 0.52, -0.38 + 0.42, 0);
  }

  // ---------- KABŁĄK SPUSTOWY
  {
    const g = part('triggerGuard');
    const s = new THREE.Shape();
    s.moveTo(-0.46, -0.4);
    s.lineTo(0.22, -0.4);
    s.lineTo(0.22, -0.62);
    s.quadraticCurveTo(0.2, -0.78, 0.02, -0.78);
    s.lineTo(-0.38, -0.78);
    s.quadraticCurveTo(-0.46, -0.78, -0.46, -0.68);
    s.closePath();
    const h = new THREE.Path();
    h.moveTo(-0.41, -0.43);
    h.lineTo(-0.41, -0.66);
    h.quadraticCurveTo(-0.41, -0.73, -0.35, -0.73);
    h.lineTo(0.0, -0.73);
    h.quadraticCurveTo(0.15, -0.73, 0.17, -0.62);
    h.lineTo(0.17, -0.43);
    h.closePath();
    s.holes.push(h);
    add(g, extrude(s, 0.07, 0.01, 20), M.metal.clone());
  }

  // ---------- SPUST (punkt obrotu u góry)
  {
    const g = part('trigger', root, -0.02, -0.4, 0);
    const s = new THREE.Shape();
    s.moveTo(-0.03, 0);
    s.lineTo(0.03, 0);
    s.quadraticCurveTo(0.03, -0.16, -0.05, -0.27);
    s.lineTo(-0.1, -0.25);
    s.quadraticCurveTo(-0.03, -0.15, -0.03, 0);
    s.closePath();
    add(g, extrude(s, 0.045, 0.008, 16), M.bright.clone());
  }

  // ---------- PRZEŁĄCZNIK RODZAJU OGNIA (prawa strona, punkt obrotu z tyłu)
  {
    const g = part('selector', root, -1.6, -0.06, 0.158);
    const mt = M.bright.clone();
    const s = new THREE.Shape();
    s.moveTo(0, -0.035);
    s.lineTo(1.2, -0.035);
    s.lineTo(1.22, -0.11);
    s.lineTo(1.33, -0.1);
    s.lineTo(1.32, 0.045);
    s.lineTo(0, 0.05);
    s.closePath();
    add(g, extrude(s, 0.018, 0.004, 8), mt);
    add(g, cylZ(0.06, 0.03, 24), mt, 0, 0, 0);
  }

  // ---------- SUWADŁO Z TŁOKIEM (+ zamek i rączka zamka jako elementy podrzędne)
  {
    const g = part('carrier');
    const mt = M.metal.clone(), br = M.bright.clone(), dk = M.dark.clone();
    add(g, box(1.65, 0.13, 0.17), mt, -0.125, 0.035, 0);
    add(g, cylX(0.075, 1.3), mt, -0.3, 0.1, 0);
    add(g, box(0.2, 0.26, 0.12), mt, 0.65, 0.17, 0);
    add(g, cylX(0.04, 2.6, 16), br, 2.0, 0.27, 0);
    add(g, cylX(0.072, 0.2), br, 3.35, 0.27, 0);
    for (const x of [3.3, 3.4]) add(g, cylX(0.074, 0.015), dk, x, 0.27, 0);

    const bolt = part('bolt', g, 0.62, 0, 0);
    const bm = M.bright.clone();
    add(bolt, cylX(0.062, 0.5), bm, 0.0, 0, 0);
    add(bolt, box(0.07, 0.05, 0.16), bm, 0.27, 0, 0);
    add(bolt, new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12), bm, -0.08, 0.07, 0);
    add(bolt, cylX(0.02, 0.12, 10), bm, -0.3, 0, 0);

    const ch = part('chargingHandle', g, 0.6, 0.03, 0);
    const cm = M.metal.clone();
    add(ch, box(0.1, 0.06, 0.26), cm, 0, 0, 0.2);
    const knob = add(ch, new THREE.SphereGeometry(0.075, 24, 16), cm, 0, 0.02, 0.36);
    knob.scale.set(1.1, 0.95, 1.2);
  }

  // ---------- ZESPÓŁ SPRĘŻYNY POWROTNEJ (punkt bazowy z tyłu)
  let coil;
  {
    const g = part('spring', root, -1.85, 0.12, 0);
    const br = M.bright.clone(), mt = M.metal.clone();
    add(g, cylX(0.016, 0.98, 10), br, 0.49, 0, 0);
    class Helix extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = t * 24 * 2 * PI;
        return target.set(t, Math.cos(a) * 0.034, Math.sin(a) * 0.034);
      }
    }
    coil = add(g, new THREE.TubeGeometry(new Helix(), 480, 0.008, 5, false), br);
    coil.scale.x = 0.9;
    add(g, box(0.09, 0.12, 0.12), mt, -0.03, 0, 0);
    add(g, box(0.06, 0.07, 0.1), mt, -0.06, 0.1, 0);
  }

  root.traverse((o) => {
    if (o.userData.part) {
      o.userData.basePos = o.position.clone();
      o.userData.baseRot = o.rotation.clone();
    }
  });

  return { root, parts, coil, muzzle: new THREE.Vector3(5.66, 0, 0) };
}
