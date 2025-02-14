export class CanvasInfo {
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
  // these are filled out in resizeToDisplaySize
  renderTarget: GPUTexture | undefined;
  renderTargetView: GPUTextureView | undefined;
  depthTexture: GPUTexture | undefined;
  depthTextureView: GPUTextureView | undefined;
  sampleCount: number; // can be 1 or 4

  constructor(canvas: HTMLCanvasElement, context: GPUCanvasContext, presentationFormat: GPUTextureFormat, sampleCount: number) {
    this.canvas = canvas;
    this.context = context;
    this.presentationFormat = presentationFormat;
    this.sampleCount = sampleCount;
  }
}

export function createFloat32Buffer(device: GPUDevice, data: Float32Array, usage: GPUFlagsConstant) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  const dst = new Float32Array(buffer.getMappedRange());
  dst.set(data);
  buffer.unmap();
  return buffer;
}

 export function createUint32Buffer(device: GPUDevice, data: Uint32Array, usage: GPUFlagsConstant) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  const dst = new Uint32Array(buffer.getMappedRange());
  dst.set(data);
  buffer.unmap();
  return buffer;
}