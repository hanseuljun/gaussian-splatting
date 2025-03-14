const shaderCode = `
struct VSUniforms {
  modelView: mat4x4f,
  projection: mat4x4f,
};
@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    @location(0) position: vec4f,
    @location(1) normal: vec4f,
    @location(2) color: vec4f,
};

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn myVSMain(v: MyVSInput) -> MyVSOutput {
  var vsOut: MyVSOutput;
  vsOut.position = vsUniforms.projection * vsUniforms.modelView * v.position;
  // Normal of the vertex in camera space.
  var normal = vsUniforms.modelView * vec4f(v.normal.xyz, 0.0);
  // Direction from camera to the vertex in camera space.
  var dir = normalize(vsUniforms.modelView * v.position);
  var diffuse = max(0.0, dot(normal.xyz, -dir.xyz));
  vsOut.color = vec4f(v.color.rgb, v.color.a * diffuse);
  // vsOut.color = vec4f(diffuse, diffuse, diffuse, 1.0);
  // vsOut.color = vec4f(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, normal.z * 0.5 + 0.5, 1.0);
  // vsOut.color = vec4f(v.normal.x * 0.5 + 0.5, v.normal.y * 0.5 + 0.5, v.normal.z * 0.5 + 0.5, 1.0);
  return vsOut;
}

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  return vec4f(v.color.rgb * v.color.a, v.color.a);
}
`;

export default shaderCode;