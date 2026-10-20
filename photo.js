// Tryb zdjęcia: gotowe ujęcia, ramka kadru 4:5 / 9:16 i eksport PNG w docelowej rozdzielczości.
import * as THREE from 'three';
import { computeLabels, drawLabels } from './disassembly.js';

const FORMATS = {
  post: { w: 1080, h: 1350, name: 'post' },
  story: { w: 1080, h: 1920, name: 'relacja' },
};

// dir — kierunek od celu do kamery, rx/ry — połówki kadru w jednostkach świata.
const SHOTS = [
  { name: 'BOK', dir: [0, 0.07, 1], target: [0.6, -0.45, 0], rx: 5.4, ry: 2.0 },
  { name: '3/4 PRZÓD', dir: [0.78, 0.3, 0.6], target: [0.7, -0.5, 0], rx: 3.1, ry: 1.9 },
  { name: 'Z GÓRY · ROZŁOŻONY', dir: [0.1, 0.62, 0.78], target: [0.45, 0.45, -0.8], rx: 5.4, ry: 3.3, explode: true },
  { name: 'KOMORA', dir: [0.38, 0.35, 1], target: [-0.35, -0.1, 0], rx: 1.6, ry: 1.0 },
  { name: 'OD DOŁU', dir: [0.5, -0.1, 0.86], target: [1.3, -0.2, 0], rx: 4.8, ry: 2.4 },
];

export function setupPhotoMode(ctx) {
  const { renderer, scene, camera, controls, state, ak, $, flyTo, setExplodeTarget, showFlash, setHover } = ctx;
  let format = 'post';
  const frame = { x: 0, y: 0, w: 100, h: 100 };

  const shotsEl = $('shots');
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = s.name;
    b.addEventListener('click', () => applyShot(i));
    shotsEl.appendChild(b);
  });

  function layout() {
    if (!state.photo) return;
    const vw = innerWidth, vh = innerHeight;
    const top = $('pbarTop').getBoundingClientRect().bottom;
    const bottom = vh - $('pbarBottom').getBoundingClientRect().top;
    const pad = Math.max(top, bottom) + 8;
    const f = FORMATS[format];
    const a = f.w / f.h;
    const availW = vw - 24, availH = Math.max(120, vh - 2 * pad);
    frame.w = Math.min(availW, availH * a);
    frame.h = frame.w / a;
    frame.x = (vw - frame.w) / 2;
    frame.y = (vh - frame.h) / 2;
    const el = $('frame');
    Object.assign(el.style, {
      left: `${frame.x}px`, top: `${frame.y}px`, width: `${frame.w}px`, height: `${frame.h}px`,
    });
    const wm = $('watermark');
    wm.style.fontSize = `${frame.w * 0.034}px`;
    wm.style.right = wm.style.bottom = `${frame.w * 0.042}px`;
  }

  function applyShot(i) {
    const s = SHOTS[i];
    [...shotsEl.children].forEach((b, j) => b.classList.toggle('on', j === i));
    if (s.explode) {
      setExplodeTarget(ctx.stepCount);
      $('tglExplode').classList.add('on');
    }
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanV = tanHalf * (frame.h / innerHeight);
    const tanH = tanHalf * (frame.w / innerHeight);
    const dist = Math.max(s.rx / tanH, s.ry / tanV);
    const target = new THREE.Vector3(...s.target);
    const pos = new THREE.Vector3(...s.dir).normalize().multiplyScalar(dist).add(target);
    pos.y = Math.max(pos.y, ctx.floorY + 0.2);
    flyTo(pos, target);
  }

  function setFormat(f) {
    format = f;
    document.querySelectorAll('[data-format]').forEach((b) => b.classList.toggle('on', b.dataset.format === f));
    layout();
  }
  document.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => setFormat(b.dataset.format)));

  $('tglLabels').addEventListener('click', (e) => {
    state.labelsOn = !state.labelsOn;
    e.currentTarget.classList.toggle('on', state.labelsOn);
  });
  $('tglFlash').addEventListener('click', (e) => {
    state.photoFlash = !state.photoFlash;
    e.currentTarget.classList.toggle('on', state.photoFlash);
    showFlash(state.photoFlash, 1);
  });
  $('tglExplode').addEventListener('click', (e) => {
    const on = state.explodeTarget < ctx.stepCount;
    setExplodeTarget(on ? ctx.stepCount : 0);
    e.currentTarget.classList.toggle('on', on);
  });
  $('btnExport').addEventListener('click', () => exportPNG());
  $('btnExitPhoto').addEventListener('click', () => exit());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.photo) exit(); });

  function enter() {
    state.photo = true;
    setHover(null);
    document.body.classList.add('photo');
    $('tglExplode').classList.toggle('on', state.explodeTarget > 0);
    $('tglLabels').classList.toggle('on', state.labelsOn);
    requestAnimationFrame(layout);
    layout();
  }

  function exit() {
    state.photo = false;
    state.photoFlash = false;
    $('tglFlash').classList.remove('on');
    showFlash(false);
    state.labelsOn = true;
    document.body.classList.remove('photo');
  }

  async function exportPNG() {
    const f = FORMATS[format];
    const btn = $('btnExport');
    btn.disabled = true;
    try {
      await Promise.all([
        document.fonts.load('40px Anton'),
        document.fonts.load('600 20px Barlow'),
      ]).catch(() => {});
      const canvas = renderExport(f.w, f.h);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `ksk-pretor-ak47-${f.name}-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      btn.disabled = false;
    }
  }

  // Renderuje dokładnie to, co widać w ramce, w rozdzielczości docelowej.
  function renderExport(W, H) {
    const vw = innerWidth, vh = innerHeight;
    const pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    camera.aspect = vw / vh;
    camera.setViewOffset(vw, vh, frame.x, frame.y, frame.w, frame.h);
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    showFlash(state.photoFlash, 1);
    renderer.render(scene, camera);

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d');
    g.drawImage(renderer.domElement, 0, 0, W, H);

    const s = W / frame.w;
    if (state.labelsOn && state.explode > 0.5) {
      drawLabels(g, computeLabels(ak.parts, camera, W, H, state.explode), s);
    }
    const fs = Math.round(W * 0.034), m = Math.round(W * 0.042);
    g.font = `${fs}px Anton, Impact, sans-serif`;
    g.fillStyle = '#ffffff';
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = `${(fs * 0.05).toFixed(1)}px`;
    g.fillText('KSK PRETOR', W - m, H - m);

    camera.clearViewOffset();
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(vw, vh, false);
    return out;
  }

  return { enter, exit, layout, applyShot, renderExport, setFormat, get frame() { return frame; } };
}
