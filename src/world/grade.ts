import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/** UE-style lift/gain, vignette, and fine grain. Cheap fullscreen pass. */
export const ColorGradeShader = {
  name: "AetherisColorGrade",
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    night: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float night;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = pow(max(col, vec3(0.0)), vec3(0.94));
      col *= vec3(1.06, 1.02, 0.98);
      col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), night * 0.06);
      vec2 p = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(p, p) * 0.12;
      col *= vig;
      float n = fract(sin(dot(vUv * 1.7 + time, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.012;
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export function createColorGradePass(): ShaderPass {
  return new ShaderPass(ColorGradeShader);
}
