import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { applyBend } from './bend.js';

// Ink outlines for the cartoon look. The scene is re-rendered with a normal material
// (same world-bend as the main pass) into a target with a depth texture, then a
// full-screen pass darkens pixels where normals or depth change abruptly.
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uThick;
uniform float uNear;
uniform float uFar;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
float lin(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
void main() {
  vec4 col = texture2D(tDiffuse, vUv);
  vec2 px = uThick / uRes;
  vec3 n0 = texture2D(tNormal, vUv).rgb;
  float d0 = lin(vUv);
  float edge = 0.0;
  vec2 offs[4];
  offs[0] = vec2(px.x, 0.0); offs[1] = vec2(-px.x, 0.0); offs[2] = vec2(0.0, px.y); offs[3] = vec2(0.0, -px.y);
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + offs[i];
    vec3 n = texture2D(tNormal, uv).rgb;
    float d = lin(uv);
    float dn = length(n - n0);
    float dd = abs(d - d0) / max(min(d, d0), 0.5);
    float e = max(smoothstep(0.55, 0.95, dn), smoothstep(0.035, 0.09, dd));
    edge = max(edge, e);
  }
  float dist = min(d0, 400.0);
  edge *= 1.0 - smoothstep(70.0, 230.0, dist); // fade with distance (fog)
  col.rgb = mix(col.rgb, uColor, clamp(edge * uStrength, 0.0, 1.0));
  gl_FragColor = col;
}`;

export class OutlinePass extends Pass {
  constructor(scene, camera, w, h) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.normalMat = applyBend(new THREE.MeshNormalMaterial());
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthTexture: new THREE.DepthTexture(w, h) });
    this.rt.depthTexture.minFilter = this.rt.depthTexture.magFilter = THREE.NearestFilter;
    this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.NearestFilter;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null },
        uRes: { value: new THREE.Vector2(w, h) }, uThick: { value: 1.2 },
        uNear: { value: camera.near }, uFar: { value: camera.far },
        uColor: { value: new THREE.Color(0x0d1233) }, uStrength: { value: 0.92 },
      },
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this._c = new THREE.Color();
    this.enabled = true;
  }

  setSize(w, h) {
    this.rt.setSize(w, h);
    this.material.uniforms.uRes.value.set(w, h);
    this.material.uniforms.uThick.value = Math.max(1.0, h / 760) * 1.25;
  }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    const cam = this.camera;
    const maskBefore = cam.layers.mask;
    const bg = this.scene.background, fog = this.scene.fog, ov = this.scene.overrideMaterial;
    const shadowAuto = renderer.shadowMap.autoUpdate;
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(this._c);

    cam.layers.disable(1);
    this.scene.background = null; this.scene.fog = null; this.scene.overrideMaterial = this.normalMat;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, cam);
    renderer.setClearColor(this._c, alpha);
    renderer.shadowMap.autoUpdate = shadowAuto;
    this.scene.overrideMaterial = ov; this.scene.fog = fog; this.scene.background = bg;
    cam.layers.mask = maskBefore;

    u.tDiffuse.value = readBuffer.texture;
    u.tNormal.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    u.uNear.value = cam.near; u.uFar.value = cam.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() { this.rt.dispose(); this.material.dispose(); this.quad.dispose(); }
}
