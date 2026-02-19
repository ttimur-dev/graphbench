export const EDGE_SHADER = `
struct Uniforms {
  resolution: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) signedDistance: f32,
  @location(2) coreHalfWidth: f32,
  @location(3) glowSize: f32,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) signedDistance: f32,
  @location(1) coreHalfWidth: f32,
  @location(2) glowSize: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;
  output.clipPosition = vec4f(clipX, clipY, 0.0, 1.0);
  output.signedDistance = input.signedDistance;
  output.coreHalfWidth = input.coreHalfWidth;
  output.glowSize = input.glowSize;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let absDistance = abs(input.signedDistance);
  let aa = max(fwidth(absDistance), 0.75);
  let core = 1.0 - smoothstep(input.coreHalfWidth - aa, input.coreHalfWidth + aa, absDistance);
  let glow = 1.0 - smoothstep(input.coreHalfWidth, input.coreHalfWidth + input.glowSize, absDistance);
  let glowCurve = pow(glow, 1.5);

  let coreColor = vec3f(0.329, 0.89, 0.84);
  let glowColor = vec3f(0.46, 0.93, 0.9);

  let alpha = max(core * 0.95, glowCurve * 0.36);
  let color = coreColor * (core * 0.92) + glowColor * (glowCurve * 0.42);

  return vec4f(color, alpha);
}
`;

export const NODE_SHADER = `
struct Uniforms {
  resolution: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn sdRoundedRect(point: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  let q = abs(point) - (halfSize - vec2f(radius, radius));
  return length(max(q, vec2f(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) localPoint: vec2f,
  @location(2) halfSize: vec2f,
  @location(3) radius: f32,
  @location(4) borderWidth: f32,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) localPoint: vec2f,
  @location(1) halfSize: vec2f,
  @location(2) radius: f32,
  @location(3) borderWidth: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;
  output.clipPosition = vec4f(clipX, clipY, 0.0, 1.0);
  output.localPoint = input.localPoint;
  output.halfSize = input.halfSize;
  output.radius = input.radius;
  output.borderWidth = input.borderWidth;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let distance = sdRoundedRect(input.localPoint, input.halfSize, input.radius);
  let aa = max(fwidth(distance), 0.8);
  let fill = 1.0 - smoothstep(-aa, aa, distance);
  let inner = 1.0 - smoothstep(-aa, aa, distance + input.borderWidth);
  let border = clamp(fill - inner, 0.0, 1.0);

  let yScale = input.localPoint.y / max(input.halfSize.y, 1.0);
  let gradientT = clamp(yScale * 0.5 + 0.5, 0.0, 1.0);

  let topColor = vec3f(0.141, 0.208, 0.31);
  let bottomColor = vec3f(0.082, 0.129, 0.196);
  var base = mix(topColor, bottomColor, gradientT);

  let sheen = clamp((1.0 - gradientT) * 1.15, 0.0, 1.0) * inner * 0.14;
  base += vec3f(0.13, 0.17, 0.21) * sheen;

  let borderColor = vec3f(0.59, 0.7, 0.88);
  let shadowDistance = max(distance, 0.0);
  let shadow = exp(-shadowDistance / max(input.radius * 0.95, 1.0)) * (1.0 - fill) * 0.34;
  let shadowColor = vec3f(0.01, 0.03, 0.07);

  let color = shadowColor * shadow + base * inner + borderColor * (border * 0.46);
  let alpha = clamp(shadow + fill, 0.0, 1.0);

  return vec4f(color, alpha);
}
`;
