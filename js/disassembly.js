// Niepełne rozkładanie: pozycje części w funkcji postępu t ∈ [0, 5].
import * as THREE from 'three';

export const STEPS = [
  'MAGAZYNEK',
  'POKRYWA KOMORY ZAMKOWEJ',
  'ZESPÓŁ SPRĘŻYNY POWROTNEJ',
  'SUWADŁO Z ZAMKIEM',
  'RURA GAZOWA Z NAKŁADKĄ',
];

// Podpisy w widoku rozłożonym: numer kroku, nazwa części, strona podpisu.
export const LABEL_DEFS = [
  { step: 0, part: 'magazine', text: 'MAGAZYNEK', side: 'bottom' },
  { step: 1, part: 'cover', text: 'POKRYWA KOMORY ZAMKOWEJ', side: 'left' },
  { step: 2, part: 'spring', text: 'ZESPÓŁ SPRĘŻYNY POWROTNEJ', side: 'left' },
  { step: 3, part: 'carrier', text: 'SUWADŁO Z TŁOKIEM', side: 'left' },
  { step: 3, part: 'bolt', text: 'ZAMEK', side: 'right' },
  { step: 4, part: 'gasTube', text: 'RURA GAZOWA Z NAKŁADKĄ', side: 'right' },
];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => x * x * (3 - 2 * x);
const seg = (p, a, b) => ease(clamp01((p - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;

export const stepProgress = (t, i) => clamp01(t - i);

// cycle ∈ [0, 1]: cofnięcie suwadła (przeładowanie / strzał), tylko w stanie złożonym.
export function applyPose(parts, coil, t, cycle) {
  for (const g of Object.values(parts)) {
    g.position.copy(g.userData.basePos);
    g.rotation.copy(g.userData.baseRot);
  }
  const P = (i) => stepProgress(t, i);

  {
    const p = P(0), a = seg(p, 0, 0.3), b = seg(p, 0.25, 1), g = parts.magazine;
    g.rotation.z = 0.16 * a;
    g.position.x += 1.05 * b;
    g.position.y += -0.06 * a - 0.3 * b;
    g.position.z += 0.9 * b;
  }
  {
    const p = P(1), a = seg(p, 0, 0.3), b = seg(p, 0.25, 1), g = parts.cover;
    g.rotation.z = -0.09 * a * (1 - b);
    g.position.x += -0.12 * a - 0.45 * b;
    g.position.y += 0.03 * a + 2.27 * b;
    g.position.z -= 2.4 * b;
  }
  {
    const p = P(2), a = seg(p, 0, 0.25), b = seg(p, 0.2, 1), g = parts.spring;
    g.position.x += 0.06 * a * (1 - b) - 0.75 * b;
    g.position.y += 1.7 * b;
    g.position.z -= 1.8 * b;
    coil.scale.x = lerp(0.9 - 0.65 * cycle - 0.06 * a, 0.92, b);
  }
  {
    const p = P(3), a = seg(p, 0, 0.35), b = seg(p, 0.3, 0.85), c = seg(p, 0.75, 1), g = parts.carrier;
    g.position.x += -0.65 * a + 0.05 * b - 0.65 * cycle;
    g.position.y += 1.12 * b;
    g.position.z -= 1.2 * b;
    const bolt = parts.bolt;
    bolt.position.x += 0.42 * c;
    bolt.rotation.x = 0.6 * Math.max(clamp01(cycle / 0.15), clamp01(a / 0.2));
  }
  {
    const p = P(4), a = seg(p, 0, 0.3), b = seg(p, 0.25, 1), g = parts.gasTube;
    g.rotation.z = -0.1 * a * (1 - b);
    g.position.x += 0.45 * b;
    g.position.y += 0.03 * a + 0.75 * b;
    g.position.z -= 0.6 * b;
  }
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

// Punkty zaczepienia podpisów w pikselach dla danej kamery i rozmiaru obrazu.
export function computeLabels(parts, camera, width, height, t) {
  const out = [];
  for (const d of LABEL_DEFS) {
    const p = stepProgress(t, d.step);
    if (p < 0.55) continue;
    _box.setFromObject(parts[d.part]);
    const c = _box.getCenter(_v);
    if (d.side === 'left') c.x = _box.min.x;
    else if (d.side === 'right') c.x = _box.max.x;
    else if (d.side === 'bottom') c.y = _box.min.y;
    else c.y = _box.max.y;
    c.project(camera);
    if (c.z > 1) continue;
    out.push({
      ...d,
      num: d.step + 1,
      x: (c.x * 0.5 + 0.5) * width,
      y: (-c.y * 0.5 + 0.5) * height,
      alpha: clamp01((p - 0.55) / 0.35),
    });
  }
  return out;
}

// Rysowanie podpisów na canvasie 2D (eksport PNG) — ten sam wygląd co w HTML.
export function drawLabels(ctx, labels, s) {
  for (const l of labels) {
    ctx.save();
    ctx.globalAlpha = l.alpha;
    const fs = 13 * s, h = 26 * s, badge = 26 * s, gap = 10 * s, padR = 10 * s;
    ctx.font = `600 ${fs}px Barlow, sans-serif`;
    const tw = ctx.measureText(l.text).width;
    const w = badge + 8 * s + tw + padR;
    let x, y;
    if (l.side === 'left') { x = l.x - gap - w; y = l.y - h / 2; }
    else if (l.side === 'right') { x = l.x + gap; y = l.y - h / 2; }
    else if (l.side === 'bottom') { x = l.x - w / 2; y = l.y + gap; }
    else { x = l.x - w / 2; y = l.y - gap - h; }
    ctx.fillStyle = '#C82323';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,10,10,0.78)';
    ctx.fillRect(x, y, w, h);
    const k = 6 * s;
    ctx.fillStyle = '#C82323';
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + badge, y);
    ctx.lineTo(x + badge - k, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `${15 * s}px Anton, sans-serif`;
    ctx.fillText(String(l.num), x + badge / 2, y + h / 2 + 0.5 * s);
    ctx.textAlign = 'left';
    ctx.font = `600 ${fs}px Barlow, sans-serif`;
    ctx.fillText(l.text, x + badge + 8 * s, y + h / 2 + 0.5 * s);
    ctx.restore();
  }
}
