/* ═══════════════════════════════════════════════════
   BOSCO FERNANDEZ — main.js
   WebGL stage (self-playing piano · particles · nebula)
   + scroll cinematography, 3D tilt, ring carousel.
   Every feature degrades gracefully: the page is fully
   readable with no WebGL, no GSAP, or no JS at all.
═══════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── ENV / UTILS ───────────────────────────────── */
const doc = document.documentElement;
doc.classList.add('js');

const RM     = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE   = matchMedia('(hover: hover) and (pointer: fine)').matches;
const MOBILE = matchMedia('(max-width: 768px)').matches;
if (RM) doc.classList.add('rm');

const hasTHREE = typeof THREE !== 'undefined';
const hasGSAP  = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
const hasLenis = typeof Lenis !== 'undefined';
if (hasGSAP) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });
  ScrollTrigger.config({ ignoreMobileResize: true });
}

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[BF]', name, e); } };

let curScroll = window.scrollY || 0;
let mouseNX = 0, mouseNY = 0;          // normalized -1..1
let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
let menuOpen = false;
let cursorTick = null, ringTick = null, genreTick = null;   // per-frame DOM FX hooks

addEventListener('pointermove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  mouseNX = (e.clientX / innerWidth  - 0.5) * 2;
  mouseNY = (e.clientY / innerHeight - 0.5) * 2;
}, { passive: true });

/* ── SMOOTH SCROLL (Lenis) ─────────────────────── */
let lenis = null;
safe('lenis', () => {
  if (!hasLenis || RM) return;
  lenis = new Lenis({
    duration: 1.15,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t))
  });
  window.__lenis = lenis;
  if (hasGSAP) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
});

function smoothScrollTo(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: RM ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
}

/* ── SCROLL PLUMBING (nav, progress bar) ───────── */
const nav = $('#nav');
const progress = $('#progress');
let lastY = 0;

function onScrollPos(y) {
  curScroll = y;
  if (nav) {
    nav.classList.toggle('solid', y > 60);
    nav.classList.toggle('hidden', y > lastY && y > 520 && !menuOpen);
  }
  if (progress) {
    const total = doc.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${total > 0 ? clamp(y / total, 0, 1) : 0})`;
  }
  lastY = y;
}
if (lenis) lenis.on('scroll', l => onScrollPos(l.scroll));
else addEventListener('scroll', () => onScrollPos(window.scrollY), { passive: true });
onScrollPos(curScroll);

/* ── MOBILE MENU + ANCHORS ─────────────────────── */
const menu = $('#mobile-menu');
const ham  = $('#ham');

function toggleMenu(force) {
  menuOpen = typeof force === 'boolean' ? force : !menuOpen;
  menu && menu.classList.toggle('open', menuOpen);
  ham  && ham.classList.toggle('active', menuOpen);
  ham  && ham.setAttribute('aria-expanded', String(menuOpen));
  doc.classList.toggle('menu-open', menuOpen);
  if (lenis) menuOpen ? lenis.stop() : lenis.start();
}
ham && ham.addEventListener('click', () => toggleMenu());

$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    if (menuOpen) toggleMenu(false);
    smoothScrollTo(el);
    history.replaceState(null, '', id);
  });
});
const toTop = $('#to-top');
toTop && toTop.addEventListener('click', () => smoothScrollTo(0));

/* ── LOADER ────────────────────────────────────── */
const loader = $('#loader');
let sceneAPI = null;

function dismissLoader() {
  if (!loader || loader.dataset.done) return;
  loader.dataset.done = '1';
  doc.classList.add('loaded');                 // releases hero CSS animations
  if (sceneAPI) sceneAPI.intro();
  if (hasGSAP && !RM) {
    gsap.timeline()
      .to('.loader-core', { opacity: 0, y: -26, duration: 0.4, ease: 'power2.in' })
      .to('.lp-top', { yPercent: -101, duration: 0.85, ease: 'power4.inOut' }, '-=0.05')
      .to('.lp-bot', { yPercent: 101,  duration: 0.85, ease: 'power4.inOut' }, '<')
      .set(loader, { display: 'none' });
  } else {
    loader.style.transition = 'opacity .5s ease';
    loader.style.opacity = '0';
    setTimeout(() => { loader.style.display = 'none'; }, 520);
  }
}
if (document.readyState === 'complete') setTimeout(dismissLoader, 600);
else addEventListener('load', () => setTimeout(dismissLoader, 500));
setTimeout(dismissLoader, 3400);               // hard failsafe

/* ── CUSTOM CURSOR ─────────────────────────────── */
safe('cursor', () => {
  if (!FINE || RM) return;
  const dot = $('#cursor-dot'), ring = $('#cursor-ring'), label = $('#cursor-label');
  if (!dot || !ring) return;
  let rx = mouseX, ry = mouseY, seen = false;

  addEventListener('pointermove', () => {
    if (!seen) { seen = true; doc.classList.add('cursor-on'); }
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  }, { passive: true });

  cursorTick = () => {
    rx = lerp(rx, mouseX, 0.18); ry = lerp(ry, mouseY, 0.18);
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
  };

  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, [data-tilt], .ring-stage');
    ring.classList.toggle('is-hover', !!t);
    const lab = e.target.closest('[data-cursor-label]');
    if (lab && label) {
      label.textContent = lab.dataset.cursorLabel;
      ring.classList.add('is-label');
    } else {
      if (label) label.textContent = '';
      ring.classList.remove('is-label');
    }
  });
});

/* ══════════════════════════════════════════════════
   WEBGL STAGE — self-playing piano, particles, notes
══════════════════════════════════════════════════ */
safe('scene', () => {
  if (!hasTHREE) { doc.classList.add('no-webgl'); return; }
  const canvas = $('#gl');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: !MOBILE, powerPreference: 'high-performance'
    });
  } catch (e) { doc.classList.add('no-webgl'); return; }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    doc.classList.add('no-webgl');
    running = false;
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050508, 15, 46);

  const camera = new THREE.PerspectiveCamera(MOBILE ? 55 : 42, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 2.3, 11.5);

  /* lights — ivory keys with a purple rim, not violet slabs */
  scene.add(new THREE.AmbientLight(0x3a3252, 2.1));
  const keyLight = new THREE.PointLight(0x9d4edd, 85, 46, 1.9);
  keyLight.position.set(0, 7, 5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xc8b8e8, 60, 36, 2);
  rimLight.position.set(-9, 3.5, -7);
  scene.add(rimLight);
  const warmLight = new THREE.DirectionalLight(0xcfc4e8, 1.7);
  warmLight.position.set(5, 9, 7);
  scene.add(warmLight);

  /* helper textures */
  const makeCanvas = size => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    return [c, c.getContext('2d')];
  };
  const softTex = (() => {
    const [c, ctx] = makeCanvas(128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glowTex = (() => {
    const [c, ctx] = makeCanvas(256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(157,78,221,.85)');
    g.addColorStop(0.4, 'rgba(114,9,183,.30)');
    g.addColorStop(1, 'rgba(114,9,183,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const noteTex = glyph => {
    const [c, ctx] = makeCanvas(128);
    ctx.font = '86px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#9D4EDD'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#ddd2f5';
    ctx.fillText(glyph, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const noteTextures = [noteTex('♪'), noteTex('♫')];

  /* ── the floating piano ─────────────────────── */
  const keysGroup = new THREE.Group();
  keysGroup.position.set(0, -2.7, 1.2);
  keysGroup.rotation.x = 0.14;
  scene.add(keysGroup);

  const WHITE_COUNT = MOBILE ? 22 : 30;
  const ARC_R = 30, SPREAD = MOBILE ? 0.8 : 1.05;
  const spacing = (ARC_R * SPREAD) / (WHITE_COUNT - 1);
  const keys = [];

  const whiteGeo = new THREE.BoxGeometry(spacing * 0.86, 0.22, 2.7);
  const blackGeo = new THREE.BoxGeometry(spacing * 0.5, 0.26, 1.65);

  const addKey = (geo, color, metal, rough, ang, radius, y) => {
    const mat = new THREE.MeshStandardMaterial({
      color, metalness: metal, roughness: rough,
      emissive: 0x7209b7, emissiveIntensity: 0, transparent: true
    });
    const m = new THREE.Mesh(geo, mat);
    const x = Math.sin(ang) * radius;
    const z = -(ARC_R - Math.cos(ang) * radius);
    m.position.set(x, y, z);
    m.rotation.y = -ang;
    m.userData = {
      base: m.position.clone(),
      baseRot: m.rotation.clone(),
      dir: new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 1.5)
             .normalize().multiplyScalar(8 + Math.random() * 14),
      spin: new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4),
      phase: Math.random() * Math.PI * 2,
      press: 0
    };
    keysGroup.add(m);
    keys.push(m);
    return m;
  };

  const PATTERN = [1, 1, 0, 1, 1, 1, 0];      // black key after C D — F G A —
  for (let i = 0; i < WHITE_COUNT; i++) {
    const ang = (i / (WHITE_COUNT - 1) - 0.5) * SPREAD;
    addKey(whiteGeo, 0xe9e6dc, 0.08, 0.32, ang, ARC_R, 0);
    if (i < WHITE_COUNT - 1 && PATTERN[i % 7]) {
      const angB = ang + (SPREAD / (WHITE_COUNT - 1)) / 2;
      addKey(blackGeo, 0x0e0e16, 0.55, 0.25, angB, ARC_R - 0.62, 0.14);
    }
  }
  keys.forEach((k, i) => { k.userData.phase = i * 0.32; });

  /* ── particles (two layers) ─────────────────── */
  const makeParticles = (count, size, opacity) => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0xcfc8e0), new THREE.Color(0xcfc8e0),
      new THREE.Color(0xc8b8e8), new THREE.Color(0x9d4edd)
    ];
    for (let i = 0; i < count; i++) {
      const r = 9 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      pos[i * 3]     = Math.cos(th) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 38;
      pos[i * 3 + 2] = Math.sin(th) * r - 6;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, map: softTex, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    const p = new THREE.Points(geo, mat);
    scene.add(p);
    return p;
  };
  const dust  = makeParticles(MOBILE ? 900 : 2200, 0.09, 0.5);
  const orbs  = makeParticles(MOBILE ? 240 : 520, 0.22, 0.32);

  /* ── nebula glow planes ─────────────────────── */
  const nebulae = [];
  const NEB = MOBILE ? 3 : 4;
  for (let i = 0; i < NEB; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.10 + Math.random() * 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const s = 26 + Math.random() * 20;
    m.scale.set(s, s, 1);
    m.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 16, -20 - Math.random() * 8);
    m.userData = { seed: Math.random() * Math.PI * 2, baseS: s };
    scene.add(m);
    nebulae.push(m);
  }

  /* ── floating music notes (pool) ────────────── */
  const NOTES = MOBILE ? 12 : 22;
  const notes = [];
  for (let i = 0; i < NOTES; i++) {
    const mat = new THREE.SpriteMaterial({
      map: noteTextures[i % 2], transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const sp = new THREE.Sprite(mat);
    const sc = 0.45 + Math.random() * 0.4;
    sp.scale.set(sc, sc, 1);
    sp.visible = false;
    sp.userData = { life: 0, max: 0, seed: Math.random() * 10, vy: 0 };
    scene.add(sp);
    notes.push(sp);
  }
  const tmpV = new THREE.Vector3();
  const spawnNote = key => {
    const sp = notes.find(n => !n.visible);
    if (!sp) return;
    key.getWorldPosition(tmpV);
    sp.position.set(tmpV.x + (Math.random() - 0.5) * 0.4, tmpV.y + 0.5, tmpV.z + 0.3);
    sp.userData.life = 0;
    sp.userData.max = 2.8 + Math.random() * 1.4;
    sp.userData.vy = 0.75 + Math.random() * 0.6;
    sp.visible = true;
  };

  /* ── animation state ────────────────────────── */
  let introT = RM ? 1 : 0;
  let introStart = 0;
  let time = 0, last = performance.now();
  let nextPress = 0.8;
  let running = true, rafId = 0;
  let camX = 0, camY = 0;

  const frame = now => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; time += dt;

    if (introStart && introT < 1) introT = smooth(clamp((now - introStart) / 2300, 0, 1));

    const heroScatter = smooth(clamp(curScroll / (innerHeight * 0.9), 0, 1));
    const p = clamp((1 - introT) + heroScatter, 0, 1);

    /* keys: wave, presses, scatter */
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], u = k.userData;
      u.press *= Math.pow(0.02, dt);           // fast decay
      const wave = Math.sin(time * 1.55 + u.phase) * 0.065 * (1 - p);
      k.position.set(
        u.base.x + u.dir.x * p,
        u.base.y + u.dir.y * p + wave - u.press * 0.17,
        u.base.z + u.dir.z * p
      );
      k.rotation.set(
        u.baseRot.x + u.spin.x * p,
        u.baseRot.y + u.spin.y * p,
        u.spin.z * p
      );
      k.material.emissiveIntensity = u.press * 2.6;
      k.material.opacity = clamp(1 - p * 1.15, 0, 1);
    }

    /* random self-playing presses + note spawns */
    nextPress -= dt;
    if (nextPress <= 0 && p < 0.35) {
      const k = keys[(Math.random() * keys.length) | 0];
      k.userData.press = 1;
      spawnNote(k);
      nextPress = 0.22 + Math.random() * 0.55;
    }

    /* notes drift upward */
    for (const sp of notes) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.life += dt;
      if (u.life >= u.max) { sp.visible = false; sp.material.opacity = 0; continue; }
      sp.position.y += u.vy * dt;
      sp.position.x += Math.sin(u.life * 2.2 + u.seed) * 0.25 * dt;
      sp.material.rotation = Math.sin(u.life * 1.6 + u.seed) * 0.25;
      const lt = u.life / u.max;
      sp.material.opacity = Math.sin(lt * Math.PI) * 0.7 * (1 - heroScatter);
    }

    /* ambient motion */
    dust.rotation.y += dt * 0.016;
    orbs.rotation.y -= dt * 0.010;
    for (const n of nebulae) {
      const b = Math.sin(time * 0.25 + n.userData.seed) * 0.08;
      n.scale.setScalar(n.userData.baseS * (1 + b));
      n.material.opacity = 0.09 + (Math.sin(time * 0.2 + n.userData.seed) + 1) * 0.035;
    }
    keyLight.position.x = Math.sin(time * 0.4) * 7;
    keyLight.intensity = 82 + Math.sin(time * 1.55) * 16;

    /* camera: mouse parallax + scroll descent */
    const total = Math.max(doc.scrollHeight - innerHeight, 1);
    const scrollP = clamp(curScroll / total, 0, 1);
    camX = lerp(camX, mouseNX * 1.1, 0.045);
    camY = lerp(camY, -mouseNY * 0.55, 0.045);
    camera.position.x = camX;
    camera.position.y = 3.1 + camY - scrollP * 2.4 + (1 - introT) * 1.2;
    camera.position.z = 11.5 + (1 - introT) * 3.2;
    camera.lookAt(0, 0.15 - scrollP * 1.6, 0);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  };

  const renderOnce = () => { camera.position.y = 3.1; camera.lookAt(0, 0.15, 0); renderer.render(scene, camera); };

  if (RM) renderOnce();
  else rafId = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (RM) return;
    if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
    else if (!doc.classList.contains('no-webgl')) {
      running = true; last = performance.now(); rafId = requestAnimationFrame(frame);
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < 769 ? 55 : 42;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (RM) renderOnce();
  });

  sceneAPI = {
    intro() { if (!introStart) introStart = performance.now(); }
  };
});

/* ══════════════════════════════════════════════════
   3D TILT CARDS (+ glare)
══════════════════════════════════════════════════ */
safe('tilt', () => {
  $$('[data-tilt-glare]').forEach(el => {
    const g = document.createElement('span');
    g.className = 'glare';
    el.appendChild(g);
  });
  if (!FINE || RM) return;

  $$('[data-tilt]').forEach(card => {
    const max = parseFloat(card.dataset.tilt) || 9;
    let tx = 0, ty = 0, rx = 0, ry = 0, raf = null, over = false;

    const loop = () => {
      rx = lerp(rx, tx, 0.14); ry = lerp(ry, ty, 0.14);
      if (over || Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) {
        card.style.transform =
          `perspective(950px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale3d(1.015,1.015,1.015)`;
        raf = requestAnimationFrame(loop);
      } else {
        card.style.transform = '';
        raf = null;
      }
    };
    card.addEventListener('pointerenter', () => { over = true; if (!raf) raf = requestAnimationFrame(loop); });
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tx = (0.5 - py) * max;
      ty = (px - 0.5) * max;
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { over = false; tx = ty = 0; });
  });
});

/* ══════════════════════════════════════════════════
   RING CAROUSEL — Shared Stages
══════════════════════════════════════════════════ */
safe('ring', () => {
  const stage = $('#ring-stage');
  const ring  = $('#artist-ring');
  if (!stage || !ring) return;
  const cards = [...ring.children];
  const n = cards.length;
  const step = 360 / n;

  let rot = 0, vel = 0, dragging = false, lastX = 0;
  let R = 400, visible = true, hover = false;

  function layout() {
    const vw = Math.min(innerWidth, 1500);
    R = clamp(vw * 0.34, 235, 500);
    const cw = clamp(R * 0.62, 152, 250);
    const chh = Math.round(cw * 1.12);
    ring.style.setProperty('--card-w', cw + 'px');
    ring.style.setProperty('--card-h', chh + 'px');
    stage.style.height = (chh + 130) + 'px';
  }
  layout();
  addEventListener('resize', layout);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '120px' })
      .observe(stage);
  }

  stage.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; vel = 0;
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    rot += dx * 0.3; vel = dx * 0.3;
  });
  const release = () => { dragging = false; };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerenter', () => { hover = true; });
  stage.addEventListener('pointerleave', () => { hover = false; dragging = false; });

  ringTick = () => {
    if (!visible) return;
    if (!dragging) {
      vel *= 0.94;
      const auto = RM ? 0 : (hover && FINE ? 0.012 : 0.05);
      rot += auto + vel;
    }
    for (let i = 0; i < n; i++) {
      const a = rot + i * step;
      const rad = a * Math.PI / 180;
      const f = (Math.cos(rad) + 1) / 2;      // 1 front, 0 back
      const c = cards[i];
      c.style.transform = `rotateY(${a.toFixed(2)}deg) translateZ(${R}px)`;
      c.style.opacity = (0.22 + 0.78 * Math.pow(f, 1.4)).toFixed(3);
      c.style.zIndex = Math.round(f * 100);
    }
  };
  ringTick();
});

/* ══════════════════════════════════════════════════
   GENRE WALL — mouse depth parallax
══════════════════════════════════════════════════ */
safe('genres', () => {
  if (!FINE || RM) return;
  const wall = $('#genre-wall');
  if (!wall) return;
  const words = $$('span', wall).map(el => ({
    el, d: parseFloat(el.dataset.depth) || 0.5, x: 0, y: 0
  }));
  genreTick = () => {
    for (const w of words) {
      w.x = lerp(w.x, mouseNX * w.d * 26, 0.06);
      w.y = lerp(w.y, mouseNY * w.d * 16, 0.06);
      w.el.style.transform = `translate3d(${w.x.toFixed(1)}px, ${w.y.toFixed(1)}px, 0)`;
    }
  };
});

/* shared DOM-FX raf loop */
(function fxLoop() {
  cursorTick && cursorTick();
  ringTick && ringTick();
  genreTick && genreTick();
  requestAnimationFrame(fxLoop);
})();

/* ══════════════════════════════════════════════════
   SCROLL CINEMATOGRAPHY (GSAP + ScrollTrigger)
══════════════════════════════════════════════════ */
safe('scrollfx', () => {
  if (!hasGSAP || RM) return;

  /* split headings into chars */
  const splitChars = root => {
    if (root.dataset.splitDone) return $$('.ch', root);
    root.dataset.splitDone = '1';
    root.setAttribute('aria-label', root.textContent.trim().replace(/\s+/g, ' '));
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent.replace(/\s+/g, ' ')) {
            if (ch === ' ') { frag.append(' '); continue; }
            const s = document.createElement('span');
            s.className = 'ch';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = ch;
            frag.append(s);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !/^(BR|SUP)$/.test(child.tagName)) {
          walk(child);
        }
      });
    };
    walk(root);
    return $$('.ch', root);
  };

  $$('[data-split]').forEach(el => {
    const chars = splitChars(el);
    gsap.fromTo(chars,
      { yPercent: 112, rotationX: -86, opacity: 0 },
      {
        yPercent: 0, rotationX: 0, opacity: 1,
        transformPerspective: 750, transformOrigin: '50% 100%',
        duration: 1.15, ease: 'power4.out', stagger: 0.024,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
  });

  /* generic reveals */
  const wall = $('#genre-wall');
  wall && wall.classList.add('reveal');
  gsap.set('.reveal', { opacity: 0, y: 36 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%', once: true,
    onEnter: batch => gsap.to(batch, {
      opacity: 1, y: 0, duration: 1.05, stagger: 0.085, ease: 'power3.out', overwrite: true
    })
  });

  /* rules draw in */
  $$('.rule').forEach(r => gsap.from(r, {
    scaleX: 0, transformOrigin: 'left center', duration: 1.1, ease: 'power3.inOut',
    scrollTrigger: { trigger: r, start: 'top 92%', once: true }
  }));

  /* counters */
  $$('[data-count]').forEach(el => {
    const numEl = el.querySelector('.num') || el;
    const target = parseInt(el.dataset.count, 10) || parseInt(numEl.textContent, 10) || 0;
    numEl.textContent = '0';
    const o = { v: 0 };
    gsap.to(o, {
      v: target, duration: 2.1, ease: 'expo.out',
      onUpdate: () => { numEl.textContent = String(Math.round(o.v)); },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* timeline: line draws with scroll, cards swing in */
  gsap.from('.tl-line', {
    scaleY: 0, transformOrigin: 'top center', ease: 'none',
    scrollTrigger: { trigger: '.timeline', start: 'top 78%', end: 'bottom 55%', scrub: 0.6 }
  });
  $$('.tl-item').forEach(item => {
    const card = $('.tl-card', item);
    const left = item.classList.contains('tl-left') && innerWidth > 900;
    gsap.fromTo(card,
      { x: left ? -70 : 70, rotationY: left ? 16 : -16, opacity: 0 },
      {
        x: 0, rotationY: 0, opacity: 1, transformPerspective: 1000,
        duration: 1.15, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: item, start: 'top 86%', once: true }
      });
    gsap.from($('.tl-dot', item), {
      scale: 0, duration: 0.7, ease: 'back.out(2.6)',
      scrollTrigger: { trigger: item, start: 'top 86%', once: true }
    });
  });

  /* parallax photo sections + curtain reveal */
  $$('.ph-section').forEach(sec => {
    const media = $('.ph-media', sec);
    const img = $('img', media);
    gsap.fromTo(img, { yPercent: -8, scale: 1.1 }, {
      yPercent: 8, scale: 1.1, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true }
    });
    gsap.fromTo(media,
      { clipPath: 'inset(0% 0% 100% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'power3.inOut',
        scrollTrigger: { trigger: sec, start: 'top 72%', once: true }
      });
  });

  /* ph3 portrait frame reveal */
  const ph3w = $('.ph3-img-wrap');
  ph3w && gsap.fromTo(ph3w,
    { clipPath: 'inset(12% 10% 12% 10% round 22px)', opacity: 0 },
    {
      clipPath: 'inset(0% 0% 0% 0% round 6px)', opacity: 1,
      duration: 1.4, ease: 'power3.inOut',
      scrollTrigger: { trigger: ph3w, start: 'top 80%', once: true }
    });

  /* ph4 — pinned cinematic punch */
  const punches = $$('.punch');
  if (punches.length) {
    gsap.timeline({
      scrollTrigger: {
        trigger: '#ph4', start: 'top top', end: '+=150%',
        scrub: 0.6, pin: true, anticipatePin: 1
      }
    })
      .fromTo(punches,
        { opacity: 0, scale: 1.65, filter: 'blur(14px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', stagger: 0.42, duration: 1, ease: 'power2.out' })
      .to({}, { duration: 0.45 });
  }

  /* skills cards cascade */
  gsap.set('.skill-card', { opacity: 0 });
  ScrollTrigger.batch('.skill-card', {
    start: 'top 88%', once: true,
    onEnter: batch => gsap.fromTo(batch,
      { y: 64, opacity: 0, rotationX: -13 },
      {
        y: 0, opacity: 1, rotationX: 0, transformPerspective: 900,
        duration: 1, stagger: 0.07, ease: 'power3.out',
        clearProps: 'transform,opacity', overwrite: true
      })
  });

  /* ring stage entrance */
  gsap.from('#ring-stage', {
    opacity: 0, y: 90, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: '#ring-stage', start: 'top 85%', once: true }
  });

  /* portrait holo card entrance */
  const pc = $('.portrait-card');
  pc && gsap.fromTo(pc,
    { rotationY: 55, opacity: 0, x: -60 },
    {
      rotationY: 0, opacity: 1, x: 0, transformPerspective: 1100,
      duration: 1.5, ease: 'power3.out', clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '#ph5', start: 'top 75%', once: true }
    });

  /* performance archive rows */
  gsap.set('.perf-item', { opacity: 0, x: -46 });
  ScrollTrigger.batch('.perf-item', {
    start: 'top 92%', once: true,
    onEnter: batch => gsap.to(batch, {
      opacity: 1, x: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
      clearProps: 'transform', overwrite: true
    })
  });

  /* closing rules */
  $$('.closing-rule').forEach(r => gsap.from(r, {
    scaleX: 0, duration: 1.2, ease: 'power3.inOut',
    scrollTrigger: { trigger: r, start: 'top 94%', once: true }
  }));

  /* nav active-section highlight */
  ['story', 'stages', 'skills', 'videos', 'contact'].forEach(id => {
    const sec = $('#' + id);
    const link = $(`.nav-links a[href="#${id}"]`);
    if (!sec || !link) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: self => link.classList.toggle('active', self.isActive)
    });
  });

  /* magnetic nav links + back-to-top */
  if (FINE) {
    $$('.nav-links a, .nav-brand, .to-top').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * 0.35,
          y: (e.clientY - r.top - r.height / 2) * 0.35,
          duration: 0.4, ease: 'power2.out'
        });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      });
    });
  }
});

})();
