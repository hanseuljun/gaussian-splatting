// see https://webgpufundamentals.org/webgpu/lessons/webgpu-utils.html#wgpu-matrix
import * as THREE from 'three';
import Camera from './camera';
import readPlyFile from './ply';
import shaderCode from './shader';
import { CanvasInfo, createFloat32Buffer, createUint32Buffer, resizeToDisplaySize } from './utils';

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
    alphaMode: 'premultiplied',
  });

  const canvasInfo = new CanvasInfo(canvas, context, presentationFormat, 4);

  const shaderModule = device.createShaderModule({code: shaderCode});

  const pipeline = device.createRenderPipeline({
    label: 'gaussian splating',
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
        // colors
        {
          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x4'},
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            }
          }
        },
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

  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
  const colors = new Float32Array([1, 0.5, 0.5, 1.0, 0.5, 0.5, 1, 1.0, 0.5, 0.5, 1, 1.0, 0.5, 0.5, 1, 1.0, 0, 0.5, 0.5, 1.0, 0, 0.5, 0.5, 1.0, 0, 0.5, 0.5, 1.0, 0, 0.5, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 1, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0, 0.5, 0, 0.5, 1.0]);
  let indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

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

  const camera = new Camera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 100);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function render(time: number) {
    if (!context) {
      fail('need a browser that supports WebGPU');
      return;
    }
    // time *= 0.001;
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
    const model = new THREE.Matrix4().identity();
    viewProjection.multiply(model).toArray(mvp);

    device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues);

    let colorView = null;
    let colorResolveTarget = undefined; 
    if (canvasInfo.sampleCount === 1) {
        const colorTexture = context.getCurrentTexture();
        colorView = colorTexture.createView();
    } else {
      colorView = canvasInfo.renderTargetView;
      colorResolveTarget = context.getCurrentTexture().createView();
    }
    if (!colorView) {
      fail("colorView is null");
      return;
    }
    if (!canvasInfo.depthTextureView) {
      fail("canvasInfo.depthTextureView is null");
      return;
    }
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: colorView,
          resolveTarget: colorResolveTarget,
          clearValue: [0.2, 0.2, 0.2, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: canvasInfo.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };

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

  function createQuadPositions(plyVertices: {[key:string]: number}[]) {
    const size = 0.01;
    const positions = [];
    for (const v of plyVertices) {
      const x = v.x;
      const y = v.y;
      const z = v.z;
      const rotation = new THREE.Quaternion(v.rot_1, v.rot_2, v.rot_3, v.rot_0);
      const v0 = new THREE.Vector3(size, size, 0).applyQuaternion(rotation);
      const v1 = new THREE.Vector3(-size, size, 0).applyQuaternion(rotation);
      const v2 = new THREE.Vector3(-size, -size, 0).applyQuaternion(rotation);
      const v3 = new THREE.Vector3(size, -size, 0).applyQuaternion(rotation);
      positions.push([x + v0.x, y + v0.y, z + v0.z]);
      positions.push([x + v1.x, y + v1.y, z + v1.z]);
      positions.push([x + v2.x, y + v2.y, z + v2.z]);
      positions.push([x + v3.x, y + v3.y, z + v3.z]);
    }
    return positions;
  }

  function createQuadColors(plyVertices: {[key:string]: number}[]) {
    const colors = [];
    for (const v of plyVertices) {
      const SH_C0 = 0.28209479177387814;
      const r = 0.5 + SH_C0 * v.f_dc_0;
      const g = 0.5 + SH_C0 * v.f_dc_1;
      const b = 0.5 + SH_C0 * v.f_dc_2;
      const a = 1.0 / (1.0 + Math.exp(-v.opacity));
      colors.push([r, g, b, a]);
      colors.push([r, g, b, a]);
      colors.push([r, g, b, a]);
      colors.push([r, g, b, a]);
    }
    return colors;
  }

  function createQuadIndices(plyVertices: {[key:string]: number}[]) {
    const indices = [];
    for (let i = 0; i < plyVertices.length; i++) {
      const offset = i * 4;
      indices.push([0, 1, 2, 0, 2, 3].map((index) => index + offset));
    }
    return indices;
  }

  async function loadGaussianSplatPly() {
    const plyVertices = await readPlyFile('./gs_FF3_lumix_4k 3.ply');
    if (!plyVertices) {
      fail('Failed to load PLY file');
      return;
    }

    console.log(`plyVertices[0]: ${JSON.stringify(plyVertices[0])}`);


    console.log(`plyVertices.length: ${plyVertices.length}`);

    const quadColors = createQuadColors(plyVertices);
    console.log(`quadColors: ${quadColors.slice(0, 10)}`);

    const plyPositions = new Float32Array(createQuadPositions(plyVertices).flat());
    const plyColors = new Float32Array(createQuadColors(plyVertices).flat());
    const plyIndices = new Uint32Array(createQuadIndices(plyVertices).flat());


    // console.log(`plyPositions: ${plyPositions}`);
    indices = plyIndices;
    const plyPositionBuffer = createFloat32Buffer(device, plyPositions, GPUBufferUsage.VERTEX);
    const plyColorBuffer = createFloat32Buffer(device, plyColors, GPUBufferUsage.VERTEX);
    const plyIndicesBuffer = createUint32Buffer(device, plyIndices, GPUBufferUsage.INDEX);
    positionBuffer = plyPositionBuffer;
    colorBuffer = plyColorBuffer;
    indicesBuffer = plyIndicesBuffer;
  }

  loadGaussianSplatPly();
}


function fail(msg: string) {
  alert(`failed: ${msg}`);
}

export default main;
