const shaderCode = `
struct VSUniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
};
@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
    @location(2) rotation: vec4f,
    @location(3) scale: vec2f,
};

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
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
  var position = v.position + rotate(vec3f(v.scale.xy, 0.0), v.rotation);
  vsOut.position = vsUniforms.projection * vsUniforms.modelView * vec4f(position, 1.0);
  // Normal of the vertex in camera space.
  // var normal = vsUniforms.modelView * vec4f(v.normal.xyz, 0.0);
  // Direction from camera to the vertex in camera space.
  // var dir = normalize(vsUniforms.modelView * vec4f(position, 1.0));
  // var diffuse = max(0.0, dot(normal.xyz, -dir.xyz));
  // vsOut.color = vec4f(v.color.rgb, v.color.a * diffuse);
  vsOut.color = vec4f(v.color.rgb, v.color.a);
  return vsOut;
}

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  return vec4f(v.color.rgb * v.color.a, v.color.a);
}
`;

export default shaderCode;