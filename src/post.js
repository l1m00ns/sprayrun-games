// Final colour pass (High preset): speed radial blur with a touch of chromatic aberration at the edges, colour grading
// (saturation, contrast, a tint that follows the light of the time of day / biome) and a soft vignette. Runs in linear HDR
// just before the OutputPass, so the grade is applied before tone mapping.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeed: { value: 0 }, // 0..1, how fast the runner is going
    uVig: { value: 0.22 },
    uSat: { value: 1.06 },
    uCon: { value: 1.04 },
    uTint: { value: [1, 1, 1] },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed, uVig, uSat, uCon; uniform vec3 uTint; varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5; float r = length(c);
      float k = uSpeed * smoothstep(0.12, 0.7, r);
      vec3 col;
      if (k < 0.002) col = texture2D(tDiffuse, vUv).rgb;
      else {
        vec2 dir = c * k * 0.05; float ab = 0.045 * k;
        col = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 6; i++) {
          float t = float(i) / 5.0; vec2 o = dir * t; float w = 1.0 - t * 0.55;
          col += vec3(texture2D(tDiffuse, vUv - o * (1.0 + ab * 6.0)).r, texture2D(tDiffuse, vUv - o).g, texture2D(tDiffuse, vUv - o * (1.0 - ab * 6.0)).b) * w; ws += w;
        }
        col /= ws;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.18) * uCon + 0.18;
      col *= uTint;
      col *= 1.0 - uVig * smoothstep(0.32, 0.95, r * 1.4);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
