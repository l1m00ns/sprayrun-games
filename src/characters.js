import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat as baseMat, ghostMat, shadowify, basicMat, fxLayer } from './materials.js';
let GHOST = false;
const mat = (col, o = {}) => (GHOST ? ghostMat(col, 0.5) : baseMat(col, { ...o, rim: true }));
import { damp, clamp } from './util.js';
import { makeGlowTexture } from './textures.js';
import { getModel } from './models.js';
import { STYLES, AURAS } from './cosmetics.js';

export const CHARACTERS = [
  { id: 'rio', name: 'Rio', cost: 0, tag: 'Cap on, hood down, no brakes', skin: '#d9a07a', top: '#ff7a1a', accent: '#fff4e0', pants: '#1f2a44', shoes: '#f4f4f4', sole: '#ff7a1a', hat: 'cap', hatColor: '#10192e', hair: '#2b1b12', bag: '#29d6ff', jacket: 'puffer' },
  { id: 'kit', name: 'Kit', cost: 0, tag: 'Rookie of the rails', skin: '#f2c29b', top: '#e8453c', accent: '#ffffff', pants: '#2b3a67', shoes: '#f7f7f7', sole: '#e8453c', hat: 'cap', hatColor: '#1d2a4a', hair: '#4a2c1a', bag: '#ffd23f' },
  { id: 'nova', name: 'Nova', cost: 600, tag: 'Beat in her headphones', skin: '#8d5a3b', top: '#7b4dff', accent: '#ffd23f', pants: '#1d1d2b', shoes: '#ffd23f', sole: '#ffffff', hat: 'phones', hatColor: '#ffd23f', hair: '#1a1210', bag: '#ff5fa2' },
  { id: 'rex', name: 'Rex', cost: 1800, tag: 'Punk of the platform', skin: '#e0a374', top: '#27b868', accent: '#111111', pants: '#3a2c2c', shoes: '#ff6b2c', sole: '#111111', hat: 'mohawk', hatColor: '#ff6b2c', hair: '#ff6b2c', bag: '#222222' },
  { id: 'zip', name: 'Zip', cost: 3500, tag: 'Never stops moving', skin: '#fbd5b5', top: '#ffd23f', accent: '#1a1a1a', pants: '#3d6cff', shoes: '#ffffff', sole: '#3d6cff', hat: 'beanie', hatColor: '#ff4f81', hair: '#d49a3a', bag: '#3d6cff' },
  { id: 'mika', name: 'Mika', cost: 6000, tag: 'Cat-ear queen', skin: '#c98a62', top: '#ff7eb6', accent: '#ffffff', pants: '#4b3a7a', shoes: '#ffffff', sole: '#ff7eb6', hat: 'cat', hatColor: '#ffffff', hair: '#2a1b3d', bag: '#7bf1ff' },
  { id: 'bolt', name: 'Bolt', cost: 10000, tag: 'Fastest on the line', skin: '#6a4129', top: '#19c3d1', accent: '#ffffff', pants: '#16384a', shoes: '#ffffff', sole: '#19c3d1', hat: 'band', hatColor: '#ffffff', hair: '#150d09', bag: '#ffffff' },
  { id: 'frost', name: 'Frost', cost: 12000, tag: 'Born on the slopes', skin: '#f0c8a8', top: '#dfeaf7', accent: '#2f7fd0', pants: '#2c4a78', shoes: '#2f7fd0', sole: '#ffffff', hat: 'goggles', hatColor: '#2f7fd0', hair: '#7a4a2a', bag: '#e8453c' },
  { id: 'coco', name: 'Coco', cost: 15000, tag: 'Beach vibes only', skin: '#b8774e', top: '#ff7a3a', accent: '#ffe27a', pants: '#29c4b0', shoes: '#ffe27a', sole: '#ffffff', hat: 'sunhat', hatColor: '#f2d48a', hair: '#1a110c', bag: '#29c4b0' },
  { id: 'dune', name: 'Dune', cost: 18000, tag: 'Desert drifter', skin: '#a8683e', top: '#c9a066', accent: '#7a2e1c', pants: '#5a4a38', shoes: '#4a3424', sole: '#2a1c12', hat: 'bandana', hatColor: '#c83a2a', hair: '#1a110c', bag: '#7a2e1c' },
  { id: 'volt', name: 'Volt', cost: 22000, tag: 'Neon courier', skin: '#e8b890', top: '#1b1f3a', accent: '#2bdcff', pants: '#10122a', shoes: '#10122a', sole: '#ff3dd0', hat: 'visor', hatColor: '#2bdcff', hair: '#ff3dd0', bag: '#2bdcff', glow: true },
  { id: 'bun', name: 'Bun', cost: 26000, tag: 'Hops faster than you', skin: '#f6d2b8', top: '#fff2f6', accent: '#ff8ab8', pants: '#8a6ad8', shoes: '#ff8ab8', sole: '#ffffff', hat: 'bunny', hatColor: '#ffffff', hair: '#8a5a3a', bag: '#ff8ab8' },
  { id: 'duke', name: 'Duke', cost: 30000, tag: 'Dapper on the rails', skin: '#7a4a2e', top: '#3a2a5a', accent: '#ffd23f', pants: '#1a1a24', shoes: '#ffd23f', sole: '#1a1a24', hat: 'tophat', hatColor: '#1a1a24', hair: '#0e0906', bag: '#8a2a2a' },
];

const GUARD_DEF = { skin: '#e8b48c', top: '#33518f', accent: '#ffd23f', pants: '#26335c', shoes: '#15151c', sole: '#000000', hat: 'police', hatColor: '#2a4378', hair: '#222', bag: null, belly: true };

let _star = null;
function getStarTex() {
  if (_star) return _star;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 33); g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 26, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
  _star = new THREE.CanvasTexture(c);
  return _star;
}
let _glow = null;
function glowTex() { return _glow || (_glow = makeGlowTexture()); }

function sph(r, m, ws = 18, hs = 14) { return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); }
function cap(r, l, m) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 12), m); }
function rbox(w, h, d, r, m) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); }
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }

function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function buildHat(head, def) {
  const hc = mat(def.hatColor, { rough: 0.7 });
  const hair = mat(def.hair, { rough: 0.8 });
  const dome = (r, m, scaleY = 1) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
    d.scale.y = scaleY;
    return d;
  };
  // hair base (back of head) for most styles
  if (!['beanie', 'cat', 'police', 'goggles', 'bunny'].includes(def.hat)) {
    const h = dome(0.325, hair, 1.0);
    h.rotation.x = 0.35;
    h.position.set(0, 0.02, 0.02);
    head.add(h);
  }
  switch (def.hat) {
    case 'cap': {
      const d = dome(0.34, hc, 1.0);
      d.position.set(0, 0.06, 0.02);
      d.rotation.x = -0.05;
      head.add(d);
      const visor = rbox(0.36, 0.04, 0.22, 0.02, hc);
      visor.position.set(0, 0.11, 0.34); // backwards cap
      visor.rotation.x = 0.1;
      head.add(visor);
      const btn = sph(0.04, mat('#ffd23f'));
      btn.position.set(0, 0.4, 0.0);
      head.add(btn);
      break;
    }
    case 'beanie':
    case 'cat': {
      const d = dome(0.345, hc, 1.08);
      d.position.set(0, 0.05, 0.0);
      head.add(d);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.045, 8, 28), mat(def.accent === '#1a1a1a' ? '#1a1a1a' : '#ffffff'));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.08;
      head.add(cuff);
      if (def.hat === 'beanie') {
        const pom = sph(0.1, mat('#ffffff', { rough: 0.9 }));
        pom.position.set(0, 0.45, 0);
        head.add(pom);
      } else {
        for (const sx of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), hc);
          ear.position.set(sx * 0.2, 0.4, -0.02);
          ear.rotation.z = -sx * 0.25;
          head.add(ear);
          const inner = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), mat('#ff9fc8'));
          inner.position.set(sx * 0.2, 0.38, -0.07);
          inner.rotation.z = -sx * 0.25;
          head.add(inner);
        }
        // hair under
        const h = dome(0.33, hair, 1.0);
        h.rotation.x = 0.45;
        h.position.set(0, -0.02, 0.06);
        head.add(h);
      }
      break;
    }
    case 'phones': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24, Math.PI), hc);
      band.rotation.z = 0;
      band.rotation.y = Math.PI / 2;
      band.position.y = 0.02;
      head.add(band);
      for (const sx of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), hc);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(sx * 0.33, 0.0, 0.0);
        head.add(cup);
      }
      // hair puffs
      for (const sx of [-1, 1]) {
        const p = sph(0.15, hair);
        p.position.set(sx * 0.23, 0.36, 0.02);
        head.add(p);
      }
      break;
    }
    case 'mohawk': {
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26 - i * 0.012, 6), hc);
        const a = -0.9 + i * 0.36;
        m.position.set(0, 0.31 * Math.cos(a) + 0.02, 0.31 * Math.sin(a));
        m.rotation.x = a;
        head.add(m);
      }
      break;
    }
    case 'band': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.03, 8, 28), hc);
      band.rotation.x = Math.PI / 2 - 0.08;
      band.position.y = 0.11;
      head.add(band);
      const top = dome(0.33, hair, 1.05);
      top.position.set(0, 0.07, 0);
      head.add(top);
      break;
    }
    case 'goggles': {
      const d = dome(0.345, hc, 1.08); d.position.set(0, 0.05, 0); head.add(d);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.04, 8, 28), mat('#1b2438')); band.rotation.x = Math.PI / 2 - 0.15; band.position.y = 0.1; head.add(band);
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 14), mat('#ffb347', { emissive: 0xff8a2a, ei: 0.5 }));
        lens.rotation.x = Math.PI / 2; lens.position.set(sx * 0.13, 0.13, -0.33); head.add(lens);
      }
      const pom = sph(0.1, mat('#ffffff')); pom.position.set(0, 0.45, 0); head.add(pom);
      break;
    }
    case 'sunhat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 24), hc); brim.position.set(0, 0.17, 0); head.add(brim);
      const crown = dome(0.3, hc, 0.9); crown.position.set(0, 0.17, 0); head.add(crown);
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 20), mat('#e8453c')); ribbon.position.set(0, 0.2, 0); head.add(ribbon);
      break;
    }
    case 'bandana': {
      const d = dome(0.335, hc, 1.02); d.position.set(0, 0.06, 0); head.add(d);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), hc); knot.rotation.x = -Math.PI / 2 - 0.4; knot.position.set(0, 0.12, 0.36); head.add(knot);
      const knot2 = knot.clone(); knot2.rotation.z = 0.5; knot2.position.set(0.05, 0.08, 0.36); head.add(knot2);
      break;
    }
    case 'visor': {
      const top = dome(0.33, hair, 1.0); top.position.set(0, 0.07, 0); head.add(top);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.13, 0.12), mat(def.hatColor, { emissive: new THREE.Color(def.hatColor), ei: 1.3 })); v.position.set(0, 0.08, -0.29); head.add(v);
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), hair); sp.position.set((i - 1.5) * 0.12, 0.4, 0.0); sp.rotation.z = (i - 1.5) * -0.12; head.add(sp); }
      break;
    }
    case 'bunny': {
      const d = dome(0.345, hc, 1.08); d.position.set(0, 0.05, 0); head.add(d);
      for (const sx of [-1, 1]) {
        const ear = cap(0.07, 0.4, hc); ear.position.set(sx * 0.14, 0.62, 0.0); ear.rotation.z = -sx * 0.18; head.add(ear);
        const inner = cap(0.04, 0.3, mat('#ff9fc8')); inner.position.set(sx * 0.14, 0.6, -0.04); inner.rotation.z = -sx * 0.18; head.add(inner);
      }
      const h2 = dome(0.33, hair, 1.0); h2.rotation.x = 0.45; h2.position.set(0, -0.02, 0.06); head.add(h2);
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), hc); brim.position.set(0, 0.26, 0); head.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.46, 20), hc); crown.position.set(0, 0.52, 0); head.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.08, 20), mat('#ffd23f')); band.position.set(0, 0.36, 0); head.add(band);
      break;
    }
    case 'santa': {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.075, 10, 26), mat('#ffffff', { rough: 0.95 }));
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.1;
      head.add(trim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.56, 20), hc);
      cone.position.set(0, 0.4, 0.07);
      cone.rotation.x = 0.4; // the tip flops backwards
      head.add(cone);
      const pom = sph(0.1, mat('#ffffff', { rough: 0.95 }));
      pom.position.set(0, 0.63, 0.2);
      head.add(pom);
      break;
    }
    case 'elf': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.62, 18), hc);
      cone.position.set(0, 0.42, 0.04);
      cone.rotation.x = 0.28;
      head.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24), mat('#ffd23f', { metal: 0.4, rough: 0.4 }));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.09;
      head.add(band);
      const bell = sph(0.06, mat('#ffd23f', { metal: 0.6, rough: 0.3 }));
      bell.position.set(0, 0.7, 0.16);
      head.add(bell);
      for (const sx of [-1, 1]) { // pointed ears
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), mat(def.skin || '#d9a07a', { rough: 0.55 }));
        ear.position.set(sx * 0.37, 0.02, 0.0);
        ear.rotation.z = -sx * 1.15;
        head.add(ear);
      }
      break;
    }
    case 'crown': {
      const gold = mat('#ffd23f', { metal: 0.7, rough: 0.25 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.15, 24), hc);
      band.position.y = 0.2;
      head.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), hc);
        spike.position.set(Math.cos(a) * 0.29, 0.38, Math.sin(a) * 0.29);
        head.add(spike);
        const gem = sph(0.035, i % 2 ? gold : mat('#ff3d7f', { emissive: 0xff3d7f, ei: 0.5 }));
        gem.position.set(Math.cos(a) * 0.31, 0.2, Math.sin(a) * 0.31);
        head.add(gem);
      }
      break;
    }
    case 'police': {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 20), hc);
      crown.position.set(0, 0.27, 0);
      head.add(crown);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.07, 20), hc);
      top.position.set(0, 0.4, -0.02);
      head.add(top);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 20, 1, false, -Math.PI * 0.5, Math.PI), mat('#111218', { rough: 0.3 }));
      visor.position.set(0, 0.17, -0.16);
      visor.scale.set(1, 1, 0.9);
      head.add(visor);
      const badge = sph(0.055, mat('#ffd23f', { metal: 0.6, rough: 0.3 }));
      badge.position.set(0, 0.27, -0.35);
      badge.scale.z = 0.35;
      head.add(badge);
      break;
    }
  }
}

// ---------------------------------------------------------------- backpacks, auras (cosmetics)
function buildBagVariant(id, torsoP, def) {
  const g = new THREE.Group();
  const accent = def.accent || '#ffffff';
  if (id === 'bg_cat') {
    const body = sph(0.2, mat('#f5efe6', { rough: 0.8 })); body.scale.set(1, 1.05, 0.9); g.add(body);
    const head = sph(0.15, mat('#f5efe6', { rough: 0.8 })); head.position.set(0, 0.26, -0.02); g.add(head);
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat('#f5efe6')); ear.position.set(sx * 0.09, 0.4, -0.02); g.add(ear); const eye = sph(0.02, mat('#222')); eye.position.set(sx * 0.055, 0.28, -0.16); g.add(eye); }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI * 1.3), mat('#f5efe6')); tail.position.set(0.18, -0.1, 0.05); tail.rotation.y = 1.2; g.add(tail);
    g.position.set(0, 0.34, 0.34);
  } else if (id === 'bg_rocket') {
    for (const sx of [-1, 1]) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.5, 12), mat('#e8e8ee', { metal: 0.4, rough: 0.35 })); body.position.set(sx * 0.14, 0.04, 0); g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 12), mat('#e8453c')); nose.position.set(sx * 0.14, 0.37, 0); g.add(nose);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.05, 12), mat('#e8453c')); band.position.set(sx * 0.14, -0.08, 0); g.add(band);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), basicMat('#ffb347', { transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); fl.rotation.x = Math.PI; fl.position.set(sx * 0.14, -0.4, 0); fl.name = 'bagflame'; fxLayer(fl); g.add(fl);
    }
    g.position.set(0, 0.36, 0.34);
  } else if (id === 'bg_guitar') {
    const body = rbox(0.34, 0.62, 0.16, 0.06, mat('#7a4a2a', { rough: 0.6 })); g.add(body);
    const neck = rbox(0.09, 0.4, 0.07, 0.02, mat('#5a3a22')); neck.position.set(0, 0.5, 0); g.add(neck);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), mat('#1a0f08')); hole.rotation.x = Math.PI / 2; hole.position.set(0, 0.02, -0.085); g.add(hole);
    const clasp = rbox(0.1, 0.05, 0.02, 0.01, mat('#ffd23f', { metal: 0.7 })); clasp.position.set(0, -0.16, -0.09); g.add(clasp);
    g.position.set(0, 0.34, 0.3); g.rotation.z = 0.35;
  } else if (id === 'bg_wings') {
    g.userData.wings = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const f = rbox(0.1, 0.55 - i * 0.07, 0.025, 0.012, mat(i % 2 ? '#ffffff' : '#e8f1ff', { rough: 0.6 }));
        f.position.set(sx * (0.12 + i * 0.1), 0.16 - i * 0.06, 0); f.rotation.z = -sx * (0.35 + i * 0.12); w.add(f);
      }
      w.position.set(sx * 0.05, 0.32, 0); g.add(w); g.userData.wings.push([w, sx]);
    }
    g.position.set(0, 0.28, 0.3);
  } else if (id === 'bg_cube') {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat('#102030', { emissive: new THREE.Color('#29f0ff'), ei: 0.35 })); g.add(c);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x29f0ff })); fxLayer(e); g.add(e);
    const sm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat('#ff3dd0', { emissive: new THREE.Color('#ff3dd0'), ei: 0.9 })); sm.name = 'cubeorbit'; g.add(sm);
    g.userData.spin = c; g.position.set(0, 0.42, 0.4);
  } else if (id === 'bg_cup') {
    const gold = mat('#ffd23f', { metal: 0.8, rough: 0.25 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.09, 0.26, 16), gold); cup.position.y = 0.12; g.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), gold); stem.position.y = -0.07; g.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 14), gold); base.position.y = -0.15; g.add(base);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), gold); h.position.set(sx * 0.18, 0.14, 0); h.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(h); }
    const gem = sph(0.04, mat('#ff3d7f', { emissive: new THREE.Color('#ff3d7f'), ei: 0.7 })); gem.position.set(0, 0.14, -0.17); g.add(gem);
    g.position.set(0, 0.34, 0.36);
  }
  for (const sx of [-1, 1]) { const strap = box(0.06, 0.5, 0.05, mat('#1b1f2b')); strap.position.set(sx * 0.16, 0.38, -0.19); torsoP.add(strap); }
  torsoP.add(g);
  shadowify(g, true, false);
  return g;
}

function buildAura(a) {
  const g = new THREE.Group();
  const add = (col, op) => basicMat(col, { transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.68, 40), add(a.color, 0.55)); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.05; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.94, 40), add(a.color2, 0.35)); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.06; g.add(r2);
  const N = 18, pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) ph[i] = Math.random() * 6.28;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: a.color2, size: 0.1, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.frustumCulled = false; g.add(pts);
  fxLayer(g);
  return { group: g, r1, r2, pts, pos, ph, N, kind: a.kind, t: 0 };
}
function updateAura(au, dt, speed) {
  au.t += dt;
  const k = 1 + Math.sin(au.t * 3) * 0.06;
  au.r1.scale.setScalar(k); au.r2.scale.setScalar(2 - k); au.r1.rotation.z += dt * 1.2; au.r2.rotation.z -= dt * 0.7;
  const fast = au.kind === 'volt' ? 3 : au.kind === 'ember' ? 0.6 : 1.2;
  for (let i = 0; i < au.N; i++) {
    const t = (au.t * 0.45 * fast + au.ph[i]) % 1, ang = au.ph[i] * 7 + au.t * (au.kind === 'volt' ? 4 : 1.4), r = 0.45 + 0.35 * Math.sin(au.ph[i] * 3 + au.t);
    au.pos[i * 3] = Math.cos(ang) * r; au.pos[i * 3 + 1] = 0.05 + t * 1.5; au.pos[i * 3 + 2] = Math.sin(ang) * r;
  }
  au.pts.geometry.attributes.position.needsUpdate = true;
  void speed;
}

// Visual scale: collider height C.PLAYER_H (1.45) over the ~2.36 tall unscaled model.
export const CHAR_SCALE = 0.614;

export function buildCharacter(def, scale = CHAR_SCALE, opts = {}) {
  GHOST = !!opts.ghost;
  try { return buildCharacterInner(def, scale); } finally { GHOST = false; }
}

function buildCharacterInner(def, scale) {
  const skin = mat(def.skin, { rough: 0.55 });
  const top = mat(def.top, { rough: 0.8 });
  const accent = mat(def.accent, def.glow ? { emissive: def.accent, ei: 1.1 } : {});
  const pants = mat(def.pants, { rough: 0.8 });
  const shoes = mat(def.shoes, { rough: 0.55 });
  const sole = mat(def.sole, { rough: 0.7 });

  const root = new THREE.Group();
  const lean = pivot(root);
  const flip = pivot(lean, 0, 0.8, 0);
  const model = pivot(flip, 0, -0.8, 0);
  model.scale.setScalar(scale);
  const hips = pivot(model, 0, 1.03, 0);

  // pelvis
  const pelvis = rbox(0.5, 0.26, 0.34, 0.1, pants);
  pelvis.position.y = 0.04;
  hips.add(pelvis);

  const torsoP = pivot(hips, 0, 0.1, 0);
  const puffer = def.jacket === 'puffer' && !def.belly;
  const torso = rbox(def.belly ? 0.7 : 0.62, 0.62, def.belly ? 0.46 : 0.38, 0.14, top);
  torso.position.y = 0.32;
  torsoP.add(torso);
  // hem / drawstrings / belt
  const belt = box(def.belly ? 0.72 : 0.64, 0.07, def.belly ? 0.48 : 0.4, mat(def.belly ? '#111' : def.accent === '#ffffff' ? '#f0f0f0' : def.accent, { rough: 0.6 }));
  belt.position.y = 0.04;
  torsoP.add(belt);
  if (def.belly) {
    const buckle = box(0.1, 0.08, 0.04, mat('#ffd23f', { metal: 0.7, rough: 0.3 }));
    buckle.position.set(0, 0.04, -0.25);
    torsoP.add(buckle);
  } else if (puffer) {
    // quilted puffer jacket: three stacked puffs, a high collar, a zip and an elastic hem; the hood hangs bunched at the back
    for (const [y, w, d] of [[0.14, 0.67, 0.44], [0.34, 0.7, 0.46], [0.53, 0.65, 0.43]]) {
      const p = rbox(w, 0.21, d, 0.09, top);
      p.position.y = y;
      torsoP.add(p);
    }
    const zip = box(0.028, 0.6, 0.02, accent);
    zip.position.set(0, 0.34, -0.245);
    torsoP.add(zip);
    const pull = rbox(0.05, 0.08, 0.02, 0.01, mat('#cfd3da', { metal: 0.6 }));
    pull.position.set(0, 0.56, -0.26);
    torsoP.add(pull);
    const hem = rbox(0.68, 0.06, 0.45, 0.025, accent);
    hem.position.y = 0.03;
    torsoP.add(hem);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.075, 10, 22), top);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.64, 0.0);
    torsoP.add(collar);
    const hoodBack = sph(0.22, top);
    hoodBack.scale.set(1.15, 0.7, 0.8);
    hoodBack.position.set(0, 0.62, 0.2);
    torsoP.add(hoodBack);
    for (const sx of [-1, 1]) { // chest pockets
      const pk = rbox(0.14, 0.015, 0.02, 0.006, accent);
      pk.position.set(sx * 0.17, 0.28, -0.235);
      pk.rotation.z = -sx * 0.25;
      torsoP.add(pk);
    }
  } else {
    // chest stripe / pocket
    const stripe = box(0.64, 0.07, 0.4, accent);
    stripe.position.y = 0.38;
    torsoP.add(stripe);
    for (const sx of [-1, 1]) {
      const cord = box(0.02, 0.2, 0.02, accent);
      cord.position.set(sx * 0.06, 0.52, -0.2);
      torsoP.add(cord);
    }
    // hood
    const hood = sph(0.26, top);
    hood.scale.set(1.2, 0.7, 0.8);
    hood.position.set(0, 0.64, 0.14);
    torsoP.add(hood);
  }
  // backpack (a cosmetic one replaces the plain pack)
  let bagGroup = null;
  if (def.bagId) bagGroup = buildBagVariant(def.bagId, torsoP, def);
  if (def.bag && !def.bagId) {
    const bag = rbox(0.44, 0.52, 0.22, 0.08, mat(def.bag, { rough: 0.6 }));
    bag.position.set(0, 0.33, 0.3);
    torsoP.add(bag);
    const pocket = rbox(0.3, 0.2, 0.08, 0.04, mat('#00000033'.length ? '#222a3a' : '#222'));
    pocket.position.set(0, 0.22, 0.43);
    torsoP.add(pocket);
    for (const sx of [-1, 1]) {
      const strap = box(0.06, 0.5, 0.05, mat('#1b1f2b'));
      strap.position.set(sx * 0.16, 0.38, -0.19);
      torsoP.add(strap);
      const strapB = box(0.06, 0.05, 0.5, mat('#1b1f2b'));
      strapB.position.set(sx * 0.16, 0.62, 0.02);
      torsoP.add(strapB);
    }
  }
  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10), skin);
  neck.position.y = 0.68;
  torsoP.add(neck);
  const head = pivot(torsoP, 0, 0.98, 0);
  const skull = sph(0.31, skin, 24, 18);
  skull.scale.set(1, 0.98, 1.0);
  head.add(skull);
  for (const sx of [-1, 1]) {
    const ear = sph(0.065, skin);
    ear.position.set(sx * 0.3, -0.02, 0.01);
    ear.scale.z = 0.6;
    head.add(ear);
    const eye = sph(0.078, mat('#ffffff', { rough: 0.2 }));
    eye.position.set(sx * 0.11, 0.03, -0.262);
    eye.scale.set(1, 1.18, 0.5);
    head.add(eye);
    const iris = sph(0.056, mat(def.eyes || '#3a2a20', { rough: 0.2 })); // coloured iris, dark pupil on top
    iris.position.set(sx * 0.108, 0.026, -0.289);
    iris.scale.set(1, 1.08, 0.45);
    head.add(iris);
    const pupil = sph(0.034, mat('#0e1016', { rough: 0.2 }));
    pupil.position.set(sx * 0.108, 0.026, -0.299);
    pupil.scale.z = 0.4;
    head.add(pupil);
    const glint = sph(0.016, basicMat('#ffffff'));
    glint.position.set(sx * 0.108 + 0.016, 0.05, -0.31);
    head.add(glint);
    const glint2 = sph(0.008, basicMat('#ffffff'));
    glint2.position.set(sx * 0.108 - 0.014, 0.004, -0.309);
    head.add(glint2);
    const lid = sph(0.082, skin); // upper eyelid: gives the eyes a calm, slightly cool look instead of a stare
    lid.position.set(sx * 0.11, 0.082, -0.254);
    lid.scale.set(1, 0.4, 0.5);
    head.add(lid);
    const cheek = sph(0.05, mat(new THREE.Color(def.skin).lerp(new THREE.Color('#ff6a6a'), 0.4).getStyle(), { rough: 0.8 }));
    cheek.position.set(sx * 0.2, -0.075, -0.235);
    cheek.scale.set(1, 0.62, 0.3);
    head.add(cheek);
    const brow = box(0.12, 0.028, 0.03, mat(def.hair === '#222' ? '#222' : def.hair, { rough: 0.8 }));
    brow.position.set(sx * 0.11, 0.13, -0.275);
    brow.rotation.z = -sx * (def.belly ? -0.35 : 0.12);
    head.add(brow);
  }
  const nose = sph(0.04, mat(def.skin, { rough: 0.5 }));
  nose.position.set(0, -0.04, -0.3);
  head.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 14, Math.PI), mat('#3a1c14'));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.1, -0.275);
  smile.scale.z = 0.5;
  head.add(smile);
  buildHat(head, def);
  let stars = null; // dizzy stars: shown after a hard crash
  if (!GHOST) {
    stars = new THREE.Group();
    const starTex = getStarTex();
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffe066, depthWrite: false, fog: false }));
      const a = (i / 3) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.46, 0.62, Math.sin(a) * 0.46); sp.scale.setScalar(0.26);
      stars.add(sp);
    }
    stars.visible = false;
    fxLayer(stars);
    head.add(stars);
  }

  // arms
  const arms = {};
  for (const [name, sx] of [['L', -1], ['R', 1]]) {
    const sh = pivot(torsoP, sx * 0.4, 0.56, 0);
    const upper = cap(0.09, 0.22, top);
    upper.position.y = -0.17;
    sh.add(upper);
    const elbow = pivot(sh, 0, -0.36, 0);
    const fore = cap(0.08, 0.2, def.belly ? top : skin);
    fore.position.y = -0.15;
    elbow.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.06, 12), accent);
    cuff.position.y = -0.03;
    elbow.add(cuff);
    const hand = sph(0.09, skin);
    hand.position.y = -0.3;
    elbow.add(hand);
    const thumb = cap(0.032, 0.05, skin);
    thumb.position.set(-sx * 0.07, -0.285, -0.045);
    thumb.rotation.set(0.5, 0, -sx * 0.5);
    elbow.add(thumb);
    if (puffer) { // the sleeve is quilted too: a second puff between shoulder and elbow
      const puff = cap(0.112, 0.06, top);
      puff.position.y = -0.3;
      sh.add(puff);
    }
    arms[name] = { sh, elbow };
  }
  // legs
  const legs = {};
  for (const [name, sx] of [['L', -1], ['R', 1]]) {
    const th = pivot(hips, sx * 0.15, -0.04, 0);
    const thigh = cap(0.115, 0.28, pants);
    thigh.position.y = -0.22;
    th.add(thigh);
    const knee = pivot(th, 0, -0.45, 0);
    const shin = cap(0.1, 0.26, pants);
    shin.position.y = -0.22;
    knee.add(shin);
    const shoe = rbox(0.22, 0.17, 0.4, 0.07, shoes);
    shoe.position.set(0, -0.44, -0.07);
    knee.add(shoe);
    const soleM = rbox(0.23, 0.06, 0.42, 0.03, sole);
    soleM.position.set(0, -0.505, -0.07);
    knee.add(soleM);
    const toe = rbox(0.2, 0.1, 0.12, 0.04, mat('#ffffff', { rough: 0.5 }));
    toe.position.set(0, -0.455, -0.2);
    knee.add(toe);
    // sneaker details: tongue, three laces, a side stripe in the accent colour, and a cuff where the trousers end
    const tongue = rbox(0.12, 0.07, 0.04, 0.015, mat('#f4f4f4', { rough: 0.7 }));
    tongue.position.set(0, -0.345, -0.065);
    tongue.rotation.x = -0.5;
    knee.add(tongue);
    for (let i = 0; i < 3; i++) {
      const lace = box(0.13, 0.016, 0.03, mat('#ffffff', { rough: 0.8 }));
      lace.position.set(0, -0.352, -0.2 + i * 0.055);
      knee.add(lace);
    }
    const sideStripe = box(0.228, 0.035, 0.22, accent);
    sideStripe.position.set(0, -0.455, -0.04);
    knee.add(sideStripe);
    const cuffP = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.045, 14), mat(def.belly ? def.pants : new THREE.Color(def.pants).lerp(new THREE.Color('#ffffff'), 0.18).getStyle(), { rough: 0.9 }));
    cuffP.position.y = -0.36;
    knee.add(cuffP);
    legs[name] = { th, knee };
  }

  // spray can held in the right hand (only visible during the start animation)
  const can = new THREE.Group();
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.24, 12), mat('#e8453c'));
  const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.07, 12), mat('#2a2d35'));
  canCap.position.y = 0.155;
  const canBand = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.06, 12), mat('#ffd23f'));
  can.add(canBody, canCap, canBand);
  can.position.set(0, -0.34, -0.08);
  can.visible = false;
  arms.R.elbow.add(can);

  shadowify(root, true, false);

  // --- extras: jetpack & board & stars
  const jet = new THREE.Group();
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 14), mat('#ff9f1c', { rough: 0.35, metal: 0.4 }));
    tank.position.set(sx * 0.14, 0.33, 0.45);
    jet.add(tank);
    const capM = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8e8ee', { rough: 0.3, metal: 0.5 }));
    capM.position.set(sx * 0.14, 0.6, 0.45);
    jet.add(capM);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 12), mat('#2b2f3a', { metal: 0.6, rough: 0.4 }));
    nozzle.position.set(sx * 0.14, 0.03, 0.45);
    jet.add(nozzle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 10), basicMat('#ffb347', { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.rotation.x = Math.PI;
    flame.position.set(sx * 0.14, -0.28, 0.45);
    flame.name = 'flame';
    fxLayer(flame);
    jet.add(flame);
  }
  shadowify(jet, true, false);
  jet.visible = false;
  torsoP.add(jet);

  const board = new THREE.Group();
  const boardModel = getModel('board'); // Blender-authored hoverboard when available
  if (boardModel) board.add(new THREE.Mesh(boardModel, mat('#ffffff', { vc: true })));
  else {
    const deck = rbox(0.62, 0.09, 1.5, 0.04, mat('#ff4f81', { rough: 0.3, metal: 0.3 }));
    board.add(deck);
    const deckTop = rbox(0.5, 0.02, 1.3, 0.01, mat('#2b2b3d', { rough: 0.9 }));
    deckTop.position.y = 0.05;
    board.add(deckTop);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), basicMat('#52f3ff', { map: glowTex(), transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.1;
  fxLayer(glow);
  board.add(glow);
  shadowify(board, true, false);
  board.visible = false;
  root.add(board);

  const sneakGlow = [];
  const rig = {
    root, lean, flip, model, hips, torso: torsoP, head,
    armL: arms.L.sh, foreL: arms.L.elbow, armR: arms.R.sh, foreR: arms.R.elbow,
    legL: legs.L.th, shinL: legs.L.knee, legR: legs.R.th, shinR: legs.R.knee,
  };
  const aura = !GHOST && def.auraId && AURAS[def.auraId] ? buildAura(AURAS[def.auraId]) : null;
  if (aura) root.add(aura.group);
  return { root, rig, jet, board, can, stars, aura, bagGroup, style: def.styleId ? STYLES[def.styleId] : null, scale, phase: 0, t: 0, state: 'run', roll: 0, def, sneakGlow, flameMats: jet.children.filter((c) => c.name === 'flame') };
}

// ---------------------------------------------------------------- animation
function setRot(b, x, y, z, dt, k) {
  b.rotation.x = damp(b.rotation.x, x, k, dt);
  b.rotation.y = damp(b.rotation.y, y, k, dt);
  b.rotation.z = damp(b.rotation.z, z, k, dt);
}

export function poseCharacter(ch, st, dt) {
  // st: { state, speed, vy, vx, rollP, stumbleT, crashT, onBoard, jet }
  const r = ch.rig;
  ch.t += dt;
  const t = ch.t;
  let k = 22;
  let hipsY = 0.92, torsoX = -0.2, torsoY = 0, torsoZ = 0, headX = 0.1, headY = 0;
  let lx = 0, rlx = 0, lk = 0, rk = 0, la = 0, ra = 0, lf = 0, rf = 0, laz = 0.1, raz = -0.1;
  let flipX = 0, modelS = ch.scale, leanZ = 0;
  let pivY = 0.8;

  const stateName = st.state;
  if (stateName === 'run' || stateName === 'sprint') {
    const rate = (stateName === 'sprint' ? 15 : 8.5 + st.speed * 0.17) * (ch.style ? ch.style.rate : 1);
    ch.phase += dt * rate;
    const s = Math.sin(ch.phase), c = Math.cos(ch.phase);
    const amp = (stateName === 'sprint' ? 1.15 : 1.0) * (ch.style ? ch.style.amp : 1);
    lx = s * amp; rlx = -s * amp;
    lk = -(0.25 + 1.2 * Math.max(0, c)); rk = -(0.25 + 1.2 * Math.max(0, -c));
    la = -s * 1.0; ra = s * 1.0;
    lf = 1.25 + 0.3 * s; rf = 1.25 - 0.3 * s;
    laz = -0.1; raz = 0.1;
    hipsY = 0.92 + 0.07 * (1 - Math.abs(s)) - 0.04;
    torsoX = -0.2; torsoY = s * 0.14; headX = 0.12; headY = -s * 0.1;
    leanZ = -(st.vx || 0) * 0.018;
    if (ch.style) { const y = ch.style; la -= y.armsBack; ra -= y.armsBack; torsoX -= y.lean; headX -= y.lean * 0.4; hipsY += y.bounce * 0.045 * Math.abs(s); if (y.pump) { la += s * 0.5; ra -= s * 0.5; lf += 0.35; rf += 0.35; } if (y.armsBack) { laz = -0.25; raz = 0.25; lf = 0.3; rf = 0.3; } }
  } else if (stateName === 'jump') {
    k = 14;
    const rising = st.vy > 0;
    lx = rising ? 1.0 : 0.6; rlx = rising ? -0.35 : -0.15;
    lk = rising ? -1.3 : -0.6; rk = rising ? -0.8 : -0.4;
    la = 2.5; ra = 2.2; lf = 0.35; rf = 0.35; laz = -0.35; raz = 0.35;
    torsoX = rising ? -0.1 : -0.02; headX = -0.08;
    hipsY = 0.92;
    leanZ = -(st.vx || 0) * 0.015;
  } else if (stateName === 'roll') {
    k = 30;
    const p = st.rollP;
    const tuck = Math.min(1, p * 8, (1 - p) * 8 + 0.0001);
    const q = clamp(tuck, 0, 1);
    lx = 1.7 * q; rlx = 1.7 * q; lk = -2.3 * q; rk = -2.3 * q;
    la = 1.3 * q; ra = 1.3 * q; lf = 2.0 * q; rf = 2.0 * q;
    torsoX = -0.85 * q; headX = 0.6 * q;
    hipsY = 0.92 - 0.1 * q;
    flipX = -p * Math.PI * 2;
    modelS = ch.scale * (1 - 0.3 * q);
    pivY = 0.55;
  } else if (stateName === 'spray') {
    k = 12;
    const sh = Math.sin(t * 22), sw = Math.sin(t * 3.2);
    ra = 1.5 + sh * 0.07; raz = 0.18 + sw * 0.14; rf = 0.55;
    la = 0.3; laz = -0.5; lf = 1.1;
    lx = 0.18; rlx = -0.22; lk = -0.22; rk = -0.1;
    torsoX = -0.1; torsoY = sw * 0.14; headX = 0.1; headY = -0.2 + sw * 0.1;
    hipsY = 0.98;
  } else if (stateName === 'stumble') {
    k = 26;
    const w = Math.sin(t * 38) * 0.5;
    if (st.kind === 'trip') { // caught the foot on a barrier: pitched forward, legs scrambling, arms windmilling
      lx = 1.0 + w * 0.6; rlx = -0.2 - w * 0.6; lk = -0.5 - w * 0.3; rk = -1.1 + w * 0.3;
      la = 2.0 + w; ra = 2.2 - w; laz = -0.5; raz = 0.5; lf = 0.5; rf = 0.5;
      torsoX = -0.75; headX = 0.35; hipsY = 0.8; torsoY = w * 0.12;
    } else if (st.kind === 'bonk') { // head into an overhead bar: snaps back, hands fly to the head
      lx = 0.3; rlx = -0.3; lk = -0.9; rk = -0.7;
      la = 2.7; ra = 2.6; laz = -0.3; raz = 0.3; lf = 1.4; rf = 1.4;
      torsoX = 0.5; headX = 0.65; hipsY = 0.82; torsoY = w * 0.1;
    } else { // side swipe: thrown off balance away from the obstacle, arms flung out
      const s = st.side || 1;
      lx = 0.5 + w * 0.5; rlx = -0.3 - w * 0.5; lk = -0.8; rk = -0.5;
      la = 0.9 + w; ra = 0.9 - w; laz = -1.25; raz = 1.25; lf = 0.3; rf = 0.3;
      torsoX = -0.1; torsoY = -s * 0.35; torsoZ = s * 0.3; headX = 0.1; hipsY = 0.86;
      leanZ = s * 0.42;
    }
  } else if (stateName === 'crash') {
    k = 12;
    const p = clamp(st.crashT / 0.45, 0, 1);
    if (st.kind === 'slam') { // hit a train head-on: thrown backwards, limbs flying
      flipX = p * 1.45;
      lx = 1.1 * p; rlx = 0.7 * p; lk = -0.6; rk = -0.9 * p;
      la = -1.6 * p; ra = -1.3 * p; laz = -1.0; raz = 1.0; lf = 0.3; rf = 0.5;
      torsoX = 0.3 * p; headX = 0.5 * p;
      hipsY = 0.9 - 0.12 * p;
      pivY = 0.8 - 0.45 * p;
    } else {
      flipX = -p * (Math.PI / 2 + 0.1);
      lx = 0.4; rlx = -0.2; lk = -0.3; rk = -0.2;
      la = 2.7 * p; ra = 2.6 * p; laz = -0.6; raz = 0.6;
      hipsY = 0.9 - 0.1 * p;
      torsoX = -0.1;
      pivY = 0.8 - 0.5 * p;
    }
  } else if (stateName === 'board') {
    // Riding: the feet stay planted on the deck, the body carves with the board instead of standing still.
    k = 12;
    ch.phase += dt * (2.2 + Math.min(st.speed || 0, 40) * 0.02);
    const sway = Math.sin(ch.phase) * 0.09, pump = Math.sin(ch.phase * 2 + 0.7);
    lx = 0.42 + sway; rlx = -0.18 - sway; lk = -0.62 + sway * 0.6; rk = -0.52 - sway * 0.6;
    la = 0.26 + pump * 0.12; ra = 0.34 - pump * 0.12; laz = -1.02 + sway * 0.5; raz = 1.02 - sway * 0.5; lf = 0.38; rf = 0.42;
    torsoX = -0.2 - 0.05 * pump; torsoY = -0.5 + sway * 0.7; headX = 0.16; headY = 0.5 - sway * 0.4;
    hipsY = 0.79 + 0.02 * pump;
    leanZ = -(st.vx || 0) * 0.035 + sway * 0.32;
  } else if (stateName === 'jet') {
    k = 10;
    lx = 0.15 + Math.sin(t * 8) * 0.1; rlx = -0.3 + Math.sin(t * 8 + 1) * 0.1; lk = -0.3; rk = -0.4;
    la = 1.5; ra = 1.5; lf = 0.6; rf = 0.6; laz = -0.3; raz = 0.3;
    torsoX = -0.45; headX = 0.35; hipsY = 0.92;
    leanZ = -(st.vx || 0) * 0.02;
  } else {
    // idle (menu)
    k = 6;
    const br = Math.sin(t * 2.0);
    lx = 0.02; rlx = -0.02; lk = -0.04; rk = -0.04;
    la = 0.06 + br * 0.03; ra = 0.06 - br * 0.03; lf = 0.35; rf = 0.35;
    laz = -0.14; raz = 0.14;
    torsoX = -0.03 + br * 0.015; headX = 0.02; headY = Math.sin(t * 0.7) * 0.5;
    hipsY = 0.92 + br * 0.008;
    torsoY = Math.sin(t * 0.7) * 0.15;
  }

  if (ch.aura) updateAura(ch.aura, dt, st.speed);
  if (ch.bagGroup) { const bg = ch.bagGroup;
    if (bg.userData.wings) for (const [w, sx] of bg.userData.wings) w.rotation.z = sx * (0.1 + Math.sin(t * (stateName === 'run' || stateName === 'sprint' ? 9 : 2.2)) * 0.12);
    if (bg.userData.spin) { bg.userData.spin.rotation.y += dt * 1.4; bg.userData.spin.rotation.x += dt * 0.6; const o = bg.getObjectByName('cubeorbit'); if (o) o.position.set(Math.cos(t * 3) * 0.28, Math.sin(t * 2) * 0.12, Math.sin(t * 3) * 0.28); }
    for (const c of bg.children) if (c.name === 'bagflame') c.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  if (ch.stars) { ch.stars.visible = stateName === 'crash' && st.crashT > 0.3; ch.stars.rotation.y = t * 5; }
  setRot(r.legL, lx, 0, 0, dt, k);
  setRot(r.legR, rlx, 0, 0, dt, k);
  setRot(r.shinL, lk, 0, 0, dt, k);
  setRot(r.shinR, rk, 0, 0, dt, k);
  setRot(r.armL, la, 0, laz, dt, k);
  setRot(r.armR, ra, 0, raz, dt, k);
  setRot(r.foreL, lf, 0, 0, dt, k);
  setRot(r.foreR, rf, 0, 0, dt, k);
  setRot(r.torso, torsoX, torsoY, torsoZ, dt, k);
  setRot(r.head, headX, headY, 0, dt, k);
  r.hips.position.y = damp(r.hips.position.y, hipsY + 0.11, k, dt);
  r.flip.rotation.x = stateName === 'roll' ? flipX : damp(r.flip.rotation.x % (Math.PI * 2), flipX, stateName === 'crash' ? 9 : 16, dt);
  r.lean.rotation.z = damp(r.lean.rotation.z, leanZ, stateName === 'stumble' ? 24 : 14, dt);
  r.model.scale.setScalar(damp(r.model.scale.x, modelS, 30, dt));
  r.flip.position.y = damp(r.flip.position.y, pivY, 30, dt);
  r.model.position.y = -r.flip.position.y;
}

// ------------------------------------------------------------------- guard
export function buildGuard() {
  const g = buildCharacter(GUARD_DEF, CHAR_SCALE * 1.17);
  return g;
}

// --------------------------------------------------------------------- dog
export function buildDog() {
  const root = new THREE.Group();
  const fur = mat('#b9733a', { rough: 0.8 });
  const dark = mat('#6e3f1d', { rough: 0.8 });
  const light = mat('#f0d9b5', { rough: 0.8 });
  const body = new THREE.Group();
  root.add(body);
  const torso = cap(0.22, 0.55, fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.62;
  body.add(torso);
  const chest = sph(0.26, light);
  chest.position.set(0, 0.6, -0.28);
  chest.scale.set(0.85, 0.9, 0.7);
  body.add(chest);
  const head = pivot(body, 0, 0.88, -0.58);
  const skull = sph(0.19, fur);
  head.add(skull);
  const snout = rbox(0.17, 0.14, 0.26, 0.06, light);
  snout.position.set(0, -0.06, -0.2);
  head.add(snout);
  const nose = sph(0.045, mat('#111'));
  nose.position.set(0, -0.0, -0.33);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), dark);
    ear.position.set(sx * 0.14, 0.2, 0.02);
    ear.rotation.z = -sx * 0.35;
    head.add(ear);
    const eye = sph(0.032, mat('#111'));
    eye.position.set(sx * 0.09, 0.05, -0.16);
    head.add(eye);
  }
  const tongue = box(0.06, 0.02, 0.1, mat('#ff6b8b'));
  tongue.position.set(0, -0.15, -0.28);
  head.add(tongue);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), mat('#e03a3a'));
  collar.position.set(0, 0.75, -0.46);
  collar.rotation.x = Math.PI / 2 - 0.5;
  body.add(collar);
  const tail = pivot(body, 0, 0.78, 0.5);
  const tailM = cap(0.05, 0.3, fur);
  tailM.position.set(0, 0.17, 0.08);
  tailM.rotation.x = 0.5;
  tail.add(tailM);
  const legs = [];
  for (const [x, z] of [[-0.14, -0.3], [0.14, -0.3], [-0.14, 0.32], [0.14, 0.32]]) {
    const p = pivot(body, x, 0.5, z);
    const l = cap(0.065, 0.3, fur);
    l.position.y = -0.2;
    p.add(l);
    const paw = sph(0.08, light);
    paw.position.set(0, -0.44, -0.02);
    paw.scale.set(1, 0.7, 1.3);
    p.add(paw);
    legs.push(p);
  }
  shadowify(root, true, false);
  return { root, body, head, tail, legs, phase: 0 };
}

export function animateDog(d, dt, speed, mode = 'run') {
  d.phase += dt * (11 + speed * 0.18);
  const s = Math.sin(d.phase), c = Math.cos(d.phase);
  d.legs[0].rotation.x = s * 0.95;
  d.legs[1].rotation.x = Math.sin(d.phase + 0.5) * 0.95;
  d.legs[2].rotation.x = Math.sin(d.phase + Math.PI) * 0.95;
  d.legs[3].rotation.x = Math.sin(d.phase + Math.PI + 0.5) * 0.95;
  d.body.rotation.x = c * 0.1;
  d.body.position.y = Math.abs(s) * 0.08;
  d.head.rotation.x = -c * 0.12 + 0.08;
  d.tail.rotation.z = Math.sin(d.phase * 1.6) * 0.5;
}
