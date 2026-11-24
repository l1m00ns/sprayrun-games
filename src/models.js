import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blender-authored props (tools/blender/make_props.py -> public/models/props.glb).
// Every object named "<model>_<part>" is merged into one geometry per <model> and painted with its
// Blender material colour; the engine then renders it with its own toon + outline shading.
const models = {};
export const getModel = (name) => models[name] || null;

export async function loadModels(url = 'models/props.glb') {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const groups = {};
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const key = o.name.split('_')[0];
      let g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
      const c = o.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      (groups[key] ||= []).push(g);
    });
    for (const [k, list] of Object.entries(groups)) models[k] = mergeGeometries(list);
  } catch (e) {
    // opened from file:// (fetch blocked) or model missing: the procedural fallbacks are used instead
  }
  return models;
}
