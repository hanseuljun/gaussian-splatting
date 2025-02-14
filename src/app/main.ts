// see https://webgpufundamentals.org/webgpu/lessons/webgpu-utils.html#wgpu-matrix
import * as THREE from 'three';
import Camera from './camera';
import readPlyFile from './ply';

async function main(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('need a browser that supports WebGPU');
    return;
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) {
    fail('need a browser that supports WebGPU');
    return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  class CanvasInfo {
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

  const canvasInfo = new CanvasInfo(canvas, context, presentationFormat, 4);

  const shaderSrc = `
  struct VSUniforms {
    mvp: mat4x4f,
  };
  @group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

  struct MyVSInput {
      @location(0) position: vec4f,
      @location(1) color: vec3f,
  };

  struct MyVSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
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
    return vec4f(v.color, 1.0);
  }
  `;

  const shaderModule = device.createShaderModule({code: shaderSrc});

  const pipeline = device.createRenderPipeline({
    label: 'gaussian splat',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      buffers: [
        // position
        {
          arrayStride: 3 * 4, // 3 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},
          ],
        },
        // normals
        {
          arrayStride: 3 * 4, // 3 floats, 4 bytes each
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x3'},
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    ...(canvasInfo.sampleCount > 1 && {
        multisample: {
          count: canvasInfo.sampleCount,
        },
    }),
  });

  function createFloat32Buffer(device: GPUDevice, data: Float32Array, usage: GPUFlagsConstant) {
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

  function createUint32Buffer(device: GPUDevice, data: Uint32Array, usage: GPUFlagsConstant) {
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

  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
  const colors   = new Float32Array([1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0]);
  let indices   = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

  let positionBuffer = createFloat32Buffer(device, positions, GPUBufferUsage.VERTEX);
  let colorBuffer = createFloat32Buffer(device, colors, GPUBufferUsage.VERTEX);
  let indicesBuffer = createUint32Buffer(device, indices, GPUBufferUsage.INDEX);

  const vUniformBufferSize = 2 * 16 * 4; // 2 mat4s * 16 floats per mat * 4 bytes per float

  const vsUniformBuffer = device.createBuffer({
    size: Math.max(16, vUniformBufferSize),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const vsUniformValues = new Float32Array(16); // 1 mat4
  const mvp = vsUniformValues.subarray(0, 16);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: vsUniformBuffer } },
    ],
  });

  const renderPassDescriptor = {
    colorAttachments: [
      {
        // view: undefined, // Assigned later
        // resolveTarget: undefined, // Assigned Later
        clearValue: [0.5, 0.5, 0.5, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      // view: undefined,  // Assigned later
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  const camera = new Camera(30, canvas.clientWidth / canvas.clientHeight, 0.5, 10);

  let wPressed = false;
  let sPressed = false;
  let aPressed = false;
  let dPressed = false;
  let upPressed = false;
  let downPressed = false;

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'w') {
      wPressed = true;
    }
    if (event.key === 's') {
      sPressed = true;
    }
    if (event.key === 'a') {
      aPressed = true;
    }
    if (event.key === 'd') {
      dPressed = true;
    }
    if (event.key === 'ArrowUp') {
      upPressed = true;
    }
    if (event.key === 'ArrowDown') {
      downPressed = true;
    }
  }

  function onkeyup(event: KeyboardEvent) {
    if (event.key === 'w') {
      wPressed = false;
    }
    if (event.key === 's') {
      sPressed = false;
    }
    if (event.key === 'a') {
      aPressed = false;
    }
    if (event.key === 'd') {
      dPressed = false;
    }
    if (event.key === 'ArrowUp') {
      upPressed = false;
    }
    if (event.key === 'ArrowDown') {
      downPressed = false;
    }
  }

  let mousePressed = false;
  let lastX = 0;
  let lastY = 0;

  function onmousedown(event: MouseEvent) {
    mousePressed = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onmousemove(event: MouseEvent) {
    if (mousePressed) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      // Use deltaX and deltaY for camera rotation or other purposes
      lastX = event.clientX;
      lastY = event.clientY;

      const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-deltaY * 0.003, -deltaX * 0.003, 0));
      camera.rotate(dq);
    }
  }

  function onmouseup() {
    mousePressed = false;
  }

  window.addEventListener('mousedown', onmousedown);
  window.addEventListener('mousemove', onmousemove);
  window.addEventListener('mouseup', onmouseup);

  window.addEventListener('keydown', onkeydown);
  window.addEventListener('keyup', onkeyup);
  function resizeToDisplaySize(device: GPUDevice, canvasInfo: CanvasInfo) {
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

  function render(time: number) {
    if (!context) {
      fail('need a browser that supports WebGPU');
      return;
    }
    time *= 0.001;
    resizeToDisplaySize(device, canvasInfo);

    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (wPressed) {
      dz -= 0.03;
    }
    if (sPressed) {
      dz += 0.03;
    }
    if (aPressed) {
      dx -= 0.03;
    }
    if (dPressed) {
      dx += 0.03;
    }
    if (upPressed) {
      dy += 0.03;
    }
    if (downPressed) {
      dy -= 0.03;
    }
    camera.move(dx, dy, dz);
    const viewProjection = camera.getViewProjection();
    const model = new THREE.Matrix4().makeRotationY(time);
    viewProjection.multiply(model).toArray(mvp);

    device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues);

    if (canvasInfo.sampleCount === 1) {
        const colorTexture = context.getCurrentTexture();
        renderPassDescriptor.colorAttachments[0].view = colorTexture.createView();
    } else {
      renderPassDescriptor.colorAttachments[0].view = canvasInfo.renderTargetView;
      renderPassDescriptor.colorAttachments[0].resolveTarget = context.getCurrentTexture().createView();
    }
    renderPassDescriptor.depthStencilAttachment.view = canvasInfo.depthTextureView;

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, colorBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, 'uint32');
    passEncoder.drawIndexed(indices.length);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  async function loadGaussianSplatPly() {
    const plyVertices = await readPlyFile('./gs_FF3_lumix_4k 3.ply');
    if (!plyVertices) {
      fail('Failed to load PLY file');
      return;
    }

    const plyPositions = new Float32Array(plyVertices.splice(0, 240).map((v) => [v.x, v.y, v.z]).flat());
    const plyColors = new Float32Array(plyVertices.splice(0, 240).map((v) => [v.f_dc_0, v.f_dc_1, v.f_dc_2]).flat());
    const plyIndices = new Uint32Array([...Array(240).keys()]);

    console.log(`plyPositions: ${plyPositions}`);
    indices = plyIndices;
    const plyPositionBuffer = createFloat32Buffer(device, plyPositions, GPUBufferUsage.VERTEX);
    const plyColorBuffer = createFloat32Buffer(device, plyColors, GPUBufferUsage.VERTEX);
    const plyIndicesBuffer = createUint32Buffer(device, plyIndices, GPUBufferUsage.INDEX);
    positionBuffer = plyPositionBuffer;
    colorBuffer = plyColorBuffer;
    indicesBuffer = plyIndicesBuffer;
  }

  await loadGaussianSplatPly();
}


function fail(msg: string) {
  alert(`failed: ${msg}`);
}

export default main;
