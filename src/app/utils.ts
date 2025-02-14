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

export function resizeToDisplaySize(device: GPUDevice, canvasInfo: CanvasInfo) {
  const {
    canvas,
    renderTarget,
    presentationFormat,
    depthTexture,
    sampleCount,
  } = canvasInfo;
  const width = Math.max(1, Math.min(device.limits.maxTextureDimension2D, canvas.clientWidth));
  const height = Math.max(1, Math.min(device.limits.maxTextureDimension2D, canvas.clientHeight));

  const needResize = !canvasInfo.renderTarget ||
                     width !== canvas.width ||
                     height !== canvas.height;
  if (needResize) {
    if (renderTarget) {
      renderTarget.destroy();
    }
    if (depthTexture) {
      depthTexture.destroy();
    }

    canvas.width = width;
    canvas.height = height;

    if (sampleCount > 1) {
      const newRenderTarget = device.createTexture({
        size: [canvas.width, canvas.height],
        format: presentationFormat,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      canvasInfo.renderTarget = newRenderTarget;
      canvasInfo.renderTargetView = newRenderTarget.createView();
    }

    const newDepthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    canvasInfo.depthTexture = newDepthTexture;
    canvasInfo.depthTextureView = newDepthTexture.createView();
  }
  return needResize;
}