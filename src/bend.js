import * as THREE from 'three';

// Shared uniforms so every material bends the world identically ("curved horizon" look)
// and every rim-lit toon material uses the same tint.
export const bend = {
  uBend: { value: new THREE.Vector2(0.0, 0.0011) },
  uRimCol: { value: new THREE.Color(0xfff2d8) },
  uRimI: { value: 0.35 },
};

const CHUNK = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
float bendD = max(-mvPosition.z - 10.0, 0.0);
mvPosition.y -= bendD * bendD * uBend.y;
mvPosition.x += bendD * bendD * uBend.x;
gl_Position = projectionMatrix * mvPosition;
`;

const RIM = `
{
  float rimT = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
  rimT = smoothstep(0.5, 0.95, rimT);
  outgoingLight += uRimCol * rimT * uRimI;
}
#include <opaque_fragment>
`;

export function applyBend(material) {
  const prev = material.onBeforeCompile;
  const rim = !!material.userData.rim && material.isMeshToonMaterial;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uBend = bend.uBend;
    shader.vertexShader = 'uniform vec2 uBend;\n' + shader.vertexShader.replace('#include <project_vertex>', CHUNK);
    if (rim) {
      shader.uniforms.uRimCol = bend.uRimCol;
      shader.uniforms.uRimI = bend.uRimI;
      shader.fragmentShader = 'uniform vec3 uRimCol;\nuniform float uRimI;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', RIM);
    }
  };
  material.customProgramCacheKey = () => 'bend-' + (rim ? 'rim' : '') + (material.userData.bendKey || '');
  return material;
}
