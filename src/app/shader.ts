const shaderCode = `
struct VSUniforms {
  mvp: mat4x4f,
};
@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    @location(0) position: vec4f,
    @location(1) color: vec4f,
};

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn myVSMain(v: MyVSInput) -> MyVSOutput {
  var vsOut: MyVSOutput;
  vsOut.position = vsUniforms.mvp * v.position;
  vsOut.color = v.color;
  return vsOut;
}

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  // return vec4f(v.color.rgb * v.color.a, v.color.a);
  return vec4f(v.color.rgb, 1.0);
}
`;

export default shaderCode;