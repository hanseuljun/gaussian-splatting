const shaderCode = `
struct VSUniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
  camera: mat4x4f,
};
@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    @location(0) position: vec3f,
    @location(1) rotation: vec4f,
    @location(2) scale: vec3f,
    @location(3) uv: vec2f,
    @location(4) color: vec4f,
};

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

fn product(q1: vec4f, q2: vec4f) -> vec4f {
  return vec4f(
    q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
    q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
  );
}

fn rotate(v: vec3f, q: vec4f) -> vec3f {
  var qv = vec4f(v.x, v.y, v.z, 0.0);
  var qr = vec4f(-q.x, -q.y, -q.z, q.w);
  var qvq = product(product(q, qv), qr);
  return vec3f(qvq.x, qvq.y, qvq.z);
}

@vertex
fn myVSMain(v: MyVSInput) -> MyVSOutput {
  var vsOut: MyVSOutput;
  var cameraRight = vsUniforms.camera * vec4f(1.0, 0.0, 0.0, 0.0);
  var cameraUp = vsUniforms.camera * vec4f(0.0, 1.0, 0.0, 0.0);
  var cameraUv = cameraRight.xyz * v.uv.x + cameraUp.xyz * v.uv.y;
  var scale = mat3x3f(vec3f(v.scale.x, 0, 0), vec3f(0, v.scale.y, 0), vec3f(0, 0, v.scale.z));
  var rotation = mat3x3f(rotate(vec3f(1, 0, 0), v.rotation), rotate(vec3f(0, 1, 0), v.rotation), rotate(vec3f(0, 0, 1), v.rotation));
  var cov = rotation * scale;
  var offset = cov * cameraUv;
  // var offset = cameraUv * 0.01;
  // var offset = vec3f(cameraUv.x * 0.01, cameraUv.y * 0.03, cameraUv.z * 0.01);
  var position = v.position + offset;
  vsOut.position = vsUniforms.projection * vsUniforms.modelView * vec4f(position, 1.0);
  vsOut.uv = v.uv;
  vsOut.color = v.color;
  return vsOut;
}

fn normal(uv: vec2f) -> f32 {
  return exp((-uv.x * uv.x - uv.y * uv.y) / 2.0);
}

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  var alpha = normal(v.uv) * v.color.a;
  return vec4f(v.color.rgb * alpha, alpha);
}
`;

export default shaderCode;