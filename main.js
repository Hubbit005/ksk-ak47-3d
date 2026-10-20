import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTextures, metalTextures, sightScaleTexture, dimpleNormal, flashTextures, floorAlpha, studioEnvironment } from './textures.js';
import { buildAK, INFO } from './model.js';
import { STEPS, applyPose, computeLabels } from './disassembly.js';
import { setupPhotoMode } from './photo.js';

const RED = 0xc82323;
const BG = 0x0a0a0a;
const FLOOR_Y = -3.0;
const STEP_COUNT = STEPS.length;
const SELECTOR = [
  { name: 'ZABEZPIECZONY', angle: 0 },
  { name: 'OGIEŃ CIĄGŁY', angle: -0.11 },
  { name: 'OGIEŃ POJEDYNCZY', angle: -0.22 },
];
const INTERACTIVE = new Set(['trigger', 'chargingHandle', 'selector']);

const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- renderer / scena
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 11, 34);
scene.environment = studioEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 120);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.5, -0.3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.2;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI * 0.62;
controls.screenSpacePanning = true;

// Widok startowy dopasowany do proporcji ekranu (panel zajmuje dół, więc cel jest niżej).
function homeView() {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  const portrait = camera.aspect < 1;
  const dir = portrait ? new THREE.Vector3(0.5, 0.22, 0.84) : new THREE.Vector3(0.22, 0.14, 1);
  const d = Math.max((portrait ? 5.0 : 5.7) / tanH, 2.9 / tanV);
  const target = new THREE.Vector3(0.5, portrait ? -1.2 : -0.75, 0);
  return { pos: dir.normalize().multiplyScalar(d).add(target), target };
}
{
  const h = homeView();
  camera.position.copy(h.pos);
  controls.target.copy(h.target);
}

// ---------------------------------------------------------------- światło studyjne
scene.add(new THREE.HemisphereLight(0x9aa0aa, 0x000000, 0.35));

const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(3, 9, 6);
key.target.position.set(0.5, -0.6, 0);
key.castShadow = true;
key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 2, far: 24 });
key.shadow.radius = isMobile ? 3 : 7;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xdfe6ff, 0.8);
fill.position.set(-7, 2, 6);
scene.add(fill);

// Kontra w kolorze marki z tyłu + czerwona plama światła na podłodze.
const rim = new THREE.SpotLight(RED, 160, 30, 0.7, 0.6, 1.4);
rim.position.set(-2.5, 4.5, -7);
rim.target.position.set(0.5, 0, 0);
const rim2 = new THREE.SpotLight(RED, 110, 30, 0.6, 0.7, 1.4);
rim2.position.set(7, 1.5, -5);
rim2.target.position.set(0.5, 0, 0);
const pool = new THREE.SpotLight(RED, 140, 25, 0.75, 1, 1.5);
pool.position.set(0.5, 7, -5.5);
pool.target.position.set(0.5, FLOOR_Y, -3.5);
scene.add(rim, rim.target, rim2, rim2.target, pool, pool.target);

// ---------------------------------------------------------------- podłoga z delikatnym odbiciem
if (!isMobile) {
  const res = Math.min(2048, Math.round(innerWidth * renderer.getPixelRatio() * 0.6));
  const mirror = new Reflector(new THREE.CircleGeometry(18, 64), {
    clipBias: 0.003, textureWidth: res, textureHeight: Math.round(res * innerHeight / innerWidth), color: 0x6a6a6a,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = FLOOR_Y;
  mirror.userData.noAO = true;
  scene.add(mirror);
}
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({
    color: 0x0e0e0e, roughness: 0.9, metalness: 0,
    transparent: !isMobile, alphaMap: isMobile ? null : floorAlpha(),
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR_Y + 0.002;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------- model
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const ak = buildAK({ wood: woodTextures(aniso), metal: metalTextures(aniso), sightScale: sightScaleTexture(), dimple: dimpleNormal() });
scene.add(ak.root);
const pickables = [];
ak.root.traverse((o) => o.isMesh && pickables.push(o));

// ---------------------------------------------------------------- błysk z lufy
const flashTex = flashTextures();
const flash = new THREE.Group();
flash.position.copy(ak.muzzle);
const additive = (map) => ({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const flashCore = new THREE.Sprite(new THREE.SpriteMaterial(additive(flashTex.radial)));
flashCore.scale.set(1.3, 1.3, 1);
flashCore.position.x = 0.25;
flash.add(flashCore);
const starGeo = new THREE.PlaneGeometry(1.8, 0.55).translate(0.9, 0, 0);
const starMat = new THREE.MeshBasicMaterial({ ...additive(flashTex.star), side: THREE.DoubleSide });
const stars = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(starGeo, starMat);
  m.rotation.x = (i * Math.PI) / 3;
  stars.add(m);
}
flash.add(stars);
const flashLight = new THREE.PointLight(0xff5a48, 0, 9, 1.4);
flashLight.position.x = 0.4;
flash.add(flashLight);
flash.visible = false;
flash.userData.noAO = true;
scene.add(flash);

function showFlash(on, strength = 1) {
  flash.visible = on;
  flashLight.intensity = on ? 60 * strength : 0;
  if (on) {
    stars.rotation.x = Math.random() * Math.PI;
    const s = 0.85 + Math.random() * 0.35;
    stars.scale.set(s * strength, s, s);
    flashCore.scale.setScalar(1.1 + Math.random() * 0.4);
  }
}

// ---------------------------------------------------------------- postprocessing (AO tylko na komputerze)
let composer = null, gtao = null;
if (!isMobile) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.9;
  // błysk i lustro podłogi nie biorą udziału w AO (lustro renderowałoby się wtedy podwójnie)
  const baseOverride = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => {
    baseOverride();
    scene.traverse((o) => { if (o.userData.noAO) o.visible = false; });
  };
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
}
function renderFrame() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
function setRenderSize(w, h, pixelRatio) {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
  }
}

// ---------------------------------------------------------------- stan
const state = {
  explode: 0,
  explodeTarget: 0,
  explodeFollow: false,
  cycle: 0,
  trigger: 0,
  selector: 0,
  selectorAngle: 0,
  busy: false,
  flashTimer: 0,
  shake: 0,
  photo: false,
  photoFlash: false,
  labelsOn: true,
  sliderDrag: false,
};

// Mini-system animacji (czas w sekundach).
const tweens = new Set();
function tween(dur, fn, done) {
  const t = { t: 0, dur, fn, done };
  tweens.add(t);
  return t;
}
const delay = (dur, done) => tween(dur, () => {}, done);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// ---------------------------------------------------------------- komunikaty
let toastTimer = 0;
function toast(title, sub = '') {
  const el = $('toast');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

// ---------------------------------------------------------------- akcje
const assembled = () => state.explode < 0.02 && state.explodeTarget === 0;

function shot() {
  state.flashTimer = 0.055;
  showFlash(true);
  state.shake = 0.22;
  tween(0.09, (k) => (state.cycle = Math.sin(k * Math.PI)));
}

function pullTrigger() {
  if (state.busy) return;
  if (!assembled()) {
    toast('SPUST', 'ZŁÓŻ KARABINEK, ABY ZOBACZYĆ STRZAŁ');
    return;
  }
  state.busy = true;
  if (state.selector === 0) {
    toast('ZABEZPIECZONY', 'KLIKNIJ PRZEŁĄCZNIK');
    tween(0.25, (k) => (state.trigger = 0.22 * Math.sin(k * Math.PI)), () => (state.busy = false));
    return;
  }
  const shots = state.selector === 1 ? 5 : 1;
  let n = 0;
  const release = () => tween(0.14, (k) => (state.trigger = 1 - k), () => (state.busy = false));
  const fire = () => {
    shot();
    n++;
    if (n < shots) delay(0.1, fire);
    else delay(0.12, release);
  };
  tween(0.06, (k) => (state.trigger = k), fire);
}

function charge() {
  if (state.busy) return;
  if (!assembled()) {
    toast('RĄCZKA ZAMKA', 'ZŁÓŻ KARABINEK');
    return;
  }
  state.busy = true;
  toast('PRZEŁADOWANIE');
  tween(0.34, (k) => (state.cycle = easeOut(k)), () =>
    delay(0.1, () => tween(0.2, (k) => (state.cycle = 1 - k * k), () => (state.busy = false))));
}

function cycleSelector() {
  state.selector = (state.selector + 1) % SELECTOR.length;
  const name = SELECTOR[state.selector].name;
  $('selState').textContent = name;
  toast(name, 'PRZEŁĄCZNIK RODZAJU OGNIA');
}

function setExplodeTarget(t, follow = false) {
  state.explodeTarget = Math.max(0, Math.min(STEP_COUNT, t));
  state.explodeFollow = follow;
}

// ---------------------------------------------------------------- podświetlanie i podpisy
let hovered = null;
function forOwnMeshes(group, fn) {
  (function rec(o) {
    for (const c of o.children) {
      if (c.userData.part) continue;
      if (c.isMesh && c.material.emissive) fn(c);
      rec(c);
    }
  })(group);
}
function setHover(g) {
  if (g === hovered) return;
  if (hovered) forOwnMeshes(hovered, (m) => { m.material.emissive.setHex(0x000000); });
  hovered = g;
  if (g) forOwnMeshes(g, (m) => { m.material.emissive.setHex(RED); m.material.emissiveIntensity = 0.55; });
  const tip = $('tooltip');
  if (g) {
    const id = g.userData.part.id;
    const hint = INTERACTIVE.has(id) ? '<div class="hint">KLIKNIJ, ABY UŻYĆ</div>' : '';
    const img = thumbs[id] ? `<img src="${thumbs[id]}" alt="">` : '';
    tip.innerHTML = `${img}<div class="body"><div class="name">${g.userData.part.label}</div><div class="desc">${INFO[id] || ''}</div>${hint}</div>`;
    tip.classList.add('show');
  } else tip.classList.remove('show');
  renderer.domElement.style.cursor = g && INTERACTIVE.has(g.userData.part.id) ? 'pointer' : 'grab';
}
function moveTooltip(x, y) {
  const tip = $('tooltip');
  const w = tip.offsetWidth, h = tip.offsetHeight, m = 10;
  let nx = x + 22, ny = y - h / 2;
  if (nx + w > innerWidth - m) nx = x - w - 22;
  nx = Math.max(m, Math.min(innerWidth - w - m, nx));
  ny = Math.max(m, Math.min(innerHeight - h - m, ny));
  tip.style.transform = `translate(${nx}px, ${ny}px)`;
}

// ---------------------------------------------------------------- miniatury części (zbliżenia do karty)
const thumbs = {};
const ISOLATE = new Set(['carrier', 'bolt', 'spring', 'chargingHandle']);
const THUMB_W = 320, THUMB_H = 190;
function makeThumbnails() {
  const cam = new THREE.PerspectiveCamera(28, THUMB_W / THUMB_H, 0.05, 60);
  const tanH = Math.tan(THREE.MathUtils.degToRad(14)) * cam.aspect, tanV = Math.tan(THREE.MathUtils.degToRad(14));
  const pr = renderer.getPixelRatio();
  const out = document.createElement('canvas');
  out.width = THUMB_W;
  out.height = THUMB_H;
  const g2 = out.getContext('2d');
  const hidden = [];
  scene.traverse((o) => { if (o.userData.noAO && o.visible) { hidden.push(o); o.visible = false; } });
  const fogNear = scene.fog.near, fogFar = scene.fog.far;
  scene.fog.near = 30;
  scene.fog.far = 60;
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_W, THUMB_H, false);
  const box = new THREE.Box3(), c = new THREE.Vector3(), size = new THREE.Vector3();
  const meshes = [];
  ak.root.traverse((o) => o.isMesh && meshes.push(o));
  const under = (o, g) => { for (let p = o; p; p = p.parent) if (p === g) return true; return false; };
  for (const [id, g] of Object.entries(ak.parts)) {
    const iso = ISOLATE.has(id);
    if (iso) for (const m of meshes) m.visible = under(m, g);
    box.setFromObject(g);
    box.getCenter(c);
    box.getSize(size);
    const rx = Math.max(size.x * 0.5, 0.22) * (iso ? 1.1 : 1.2);
    const ry = Math.max(size.y * 0.5, 0.16) * (iso ? 1.25 : 1.35);
    const dist = Math.max(rx / tanH, ry / tanV) + size.z * 0.5;
    const dir = new THREE.Vector3(0.38, 0.3, 1).normalize();
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.lookAt(c);
    renderer.render(scene, cam);
    g2.drawImage(renderer.domElement, 0, 0, THUMB_W, THUMB_H);
    thumbs[id] = out.toDataURL('image/jpeg', 0.86);
    if (iso) for (const m of meshes) m.visible = true;
  }
  thumbs.upperHandguard = thumbs.upperHandguard || thumbs.gasTube;
  for (const o of hidden) o.visible = true;
  scene.fog.near = fogNear;
  scene.fog.far = fogFar;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  let o = hit ? hit.object : null;
  while (o && !o.userData.part) o = o.parent;
  return o;
}

let pendingMove = null;
let down = null;
let tapTimer = 0;
const el = renderer.domElement;
el.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') pendingMove = { x: e.clientX, y: e.clientY, buttons: e.buttons };
});
el.addEventListener('pointerleave', () => { pendingMove = null; if (!state.photo) setHover(null); });
el.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (e.pointerType === 'mouse') el.style.cursor = hovered && INTERACTIVE.has(hovered.userData.part.id) ? 'pointer' : 'grabbing';
});
el.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 500;
  down = null;
  if (moved > 7 || !quick) return;
  const g = pick(e.clientX, e.clientY);
  if (!state.photo && e.pointerType !== 'mouse') {
    // dotyk: krótko pokaż nazwę dotkniętej części
    setHover(g);
    if (g) moveTooltip(e.clientX, e.clientY);
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => setHover(null), 3500);
  }
  if (!g) return;
  const id = g.userData.part.id;
  if (id === 'trigger') pullTrigger();
  else if (id === 'chargingHandle') charge();
  else if (id === 'selector') cycleSelector();
});

// ---------------------------------------------------------------- panel
const slider = $('slider');
function syncSlider() {
  const v = Math.round(state.explode * 100);
  if (!state.sliderDrag && +slider.value !== v) slider.value = v;
  slider.style.setProperty('--fill', `${(slider.value / 5)}%`);
}
slider.addEventListener('pointerdown', () => (state.sliderDrag = true));
addEventListener('pointerup', () => (state.sliderDrag = false));
slider.addEventListener('input', () => {
  setExplodeTarget(slider.value / 100, true);
  slider.style.setProperty('--fill', `${(slider.value / 5)}%`);
});

$('btnExplode').addEventListener('click', () => setExplodeTarget(STEP_COUNT));
$('btnAssemble').addEventListener('click', () => setExplodeTarget(0));
$('btnNext').addEventListener('click', () => setExplodeTarget(Math.floor(state.explodeTarget + 0.001) + 1));
$('btnPrev').addEventListener('click', () => setExplodeTarget(Math.ceil(state.explodeTarget - 0.001) - 1));

let lastCaption = '';
function syncCaption() {
  const t = state.explode;
  const k = t < 0.02 ? 0 : Math.min(STEP_COUNT, Math.ceil(t - 0.02));
  const text = k === 0 ? 'KARABINEK ZŁOŻONY' : STEPS[k - 1];
  const key = `${k}|${text}`;
  if (key !== lastCaption) {
    lastCaption = key;
    $('stepCaption').innerHTML = `<span class="k">KROK ${k}/${STEP_COUNT}</span><span class="t">${text}</span>`;
  }
  $('btnPrev').disabled = state.explodeTarget <= 0;
  $('btnNext').disabled = state.explodeTarget >= STEP_COUNT;
}

// ---------------------------------------------------------------- podpisy w widoku rozłożonym (HTML)
const labelLayer = $('labels');
const labelEls = new Map();
function updateLabels() {
  const show = state.labelsOn && state.explode > 0.5;
  const list = show ? computeLabels(ak.parts, camera, innerWidth, innerHeight, state.explode) : [];
  const seen = new Set();
  for (const l of list) {
    const k = l.part;
    seen.add(k);
    let e = labelEls.get(k);
    if (!e) {
      e = document.createElement('div');
      e.className = `tag ${l.side}`;
      e.innerHTML = `<div class="dot"></div><div class="box"><span class="num">${l.num}</span><span class="txt">${l.text}</span></div>`;
      labelLayer.appendChild(e);
      labelEls.set(k, e);
    }
    e.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
    e.style.opacity = l.alpha;
    e.style.display = '';
  }
  for (const [k, e] of labelEls) if (!seen.has(k)) e.style.display = 'none';
}

// ---------------------------------------------------------------- kamera (przejścia ujęć)
let camTween = null;
function flyTo(pos, target, dur = 1.2) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  controls.enabled = false;
  if (camTween) tweens.delete(camTween);
  camTween = tween(dur, (k) => {
    const e = easeInOut(k);
    camera.position.lerpVectors(p0, pos, e);
    controls.target.lerpVectors(t0, target, e);
  }, () => { controls.enabled = true; camTween = null; });
}

// ---------------------------------------------------------------- tryb zdjęcia
const photo = setupPhotoMode({
  renderer, scene, camera, controls, state, ak, $, flyTo, renderFrame, setRenderSize, setExplodeTarget, showFlash, setHover,
  stepCount: STEP_COUNT, floorY: FLOOR_Y,
});
$('btnPhoto').addEventListener('click', () => photo.enter());

// ---------------------------------------------------------------- pętla
const clock = new THREE.Clock();
const shakeOffset = new THREE.Vector3();
let frames = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);

  for (const t of [...tweens]) {
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    t.fn(k);
    if (k >= 1) {
      tweens.delete(t);
      t.done && t.done();
    }
  }

  // rozkładanie / składanie
  const diff = state.explodeTarget - state.explode;
  if (state.explodeFollow) state.explode += diff * Math.min(1, dt * 10);
  else state.explode += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.05);
  if (Math.abs(state.explodeTarget - state.explode) < 1e-4) state.explode = state.explodeTarget;

  applyPose(ak.parts, ak.coil, state.explode, state.cycle);
  ak.parts.trigger.rotation.z = -0.3 * state.trigger;
  state.selectorAngle += (SELECTOR[state.selector].angle - state.selectorAngle) * Math.min(1, dt * 14);
  ak.parts.selector.rotation.z = state.selectorAngle;

  if (state.flashTimer > 0) {
    state.flashTimer -= dt;
    if (state.flashTimer <= 0) showFlash(state.photo && state.photoFlash, 1);
  }

  if (pendingMove && !state.photo) {
    const g = pendingMove.buttons === 0 ? pick(pendingMove.x, pendingMove.y) : hovered;
    setHover(g);
    if (g) moveTooltip(pendingMove.x, pendingMove.y);
    pendingMove = null;
  }

  if (controls.enabled) controls.update();
  const minY = FLOOR_Y + 0.18;
  if (camera.position.y < minY) camera.position.y = minY;

  if (state.shake > 0) {
    state.shake -= dt;
    const a = Math.max(0, state.shake) * 0.28;
    shakeOffset.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    camera.position.add(shakeOffset);
  } else shakeOffset.set(0, 0, 0);

  // mgła liczona od celu kamery, żeby model nigdy w niej nie znikał
  const camDist = camera.position.distanceTo(controls.target);
  scene.fog.near = camDist + 3;
  scene.fog.far = camDist + 24;

  camera.lookAt(controls.target);
  renderFrame();
  camera.position.sub(shakeOffset);

  updateLabels();
  syncSlider();
  syncCaption();

  if (++frames === 1) makeThumbnails();
  if (frames === 3) $('loading').classList.add('hide');
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  photo.layout();
});

renderer.setAnimationLoop(frame);

// Udostępnione do testów automatycznych.
function settle() {
  for (let i = 0; i < 200 && tweens.size; i++) {
    for (const t of [...tweens]) { t.fn(1); tweens.delete(t); t.done && t.done(); }
  }
  state.explode = state.explodeTarget;
}
window.__ak = { settle, state, camera, controls, photo, setExplodeTarget, pullTrigger, charge, cycleSelector };
