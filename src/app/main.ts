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
        // rotations
        {
          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x4'},
          ],
        },
        // scales
        {
          arrayStride: 4 * 3, // 3 floats, 4 bytes each
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x3'},
          ],
        },
        // uvs
        {
          arrayStride: 4 * 2, // 2 floats, 4 bytes each
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},
          ],
        },
        // colors
        {
          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          attributes: [
            {shaderLocation: 4, offset: 0, format: 'float32x4'},
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

  let positionBuffer = createFloat32Buffer(device, new Float32Array([]), GPUBufferUsage.VERTEX);
  let rotationBuffer = createFloat32Buffer(device, new Float32Array([]), GPUBufferUsage.VERTEX);
  let scaleBuffer = createFloat32Buffer(device, new Float32Array([]), GPUBufferUsage.VERTEX);
  let uvBuffer = createFloat32Buffer(device, new Float32Array([]), GPUBufferUsage.VERTEX);
  let colorBuffer = createFloat32Buffer(device, new Float32Array([]), GPUBufferUsage.VERTEX);
  let indicesBuffer = createUint32Buffer(device, new Uint32Array([]), GPUBufferUsage.INDEX);
  let indexCount = 0;

  const vUniformBufferSize = 3 * 16 * 4; // 3 mat4s * 16 floats per mat * 4 bytes per float

  const vsUniformBuffer = device.createBuffer({
    size: vUniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const vsUniformValues = new Float32Array(48); // 3 mat4s
  const modelViewValues = vsUniformValues.subarray(0, 16);
  const projectionValues = vsUniformValues.subarray(16, 32);
  const cameraValues = vsUniformValues.subarray(32, 48);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: vsUniformBuffer } },
    ],
  });

  // const camera = new Camera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  const camera = new Camera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 10);

  let wPressed = false;
  let sPressed = false;
  let aPressed = false;
  let dPressed = false;
  let upPressed = false;
  let downPressed = false;
  let sortRequested = false;

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
    if (event.key === 'r') {
      sortRequested = true;
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

  function createQuadPositions(plyVertices: {[key:string]: number}[]) {
    const positions = [];
    for (const v of plyVertices) {
      positions.push([v.x, v.y, v.z]);
      positions.push([v.x, v.y, v.z]);
      positions.push([v.x, v.y, v.z]);
      positions.push([v.x, v.y, v.z]);
    }
    return positions;
  }

  function createQuadRotations(plyVertices: {[key:string]: number}[]) {
    const rotations = [];
    for (const v of plyVertices) {
      rotations.push([v.rot_1, v.rot_2, v.rot_3, v.rot_0]);
      rotations.push([v.rot_1, v.rot_2, v.rot_3, v.rot_0]);
      rotations.push([v.rot_1, v.rot_2, v.rot_3, v.rot_0]);
      rotations.push([v.rot_1, v.rot_2, v.rot_3, v.rot_0]);
    }
    return rotations;
  }

  function createQuadScales(plyVertices: {[key:string]: number}[]) {
    const offsets = [];
    for (const v of plyVertices) {
      const x = Math.exp(v.scale_0);
      const y = Math.exp(v.scale_1);
      const z = Math.exp(v.scale_2);
      offsets.push([x, y, z]);
      offsets.push([x, y, z]);
      offsets.push([x, y, z]);
      offsets.push([x, y, z]);
    }
    return offsets;
  }

  function createQuadUvs(plyVertices: {[key:string]: number}[]) {
    const uvs = [];
    for (const v of plyVertices) {
      uvs.push([ 4.0,  4.0]);
      uvs.push([-4.0,  4.0]);
      uvs.push([-4.0, -4.0]);
      uvs.push([ 4.0, -4.0]);
    }
    return uvs;
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

  function createQuadIndices(plyVertices: {[key:string]: number}[], viewMatrix: THREE.Matrix4) {
    class VertexForSort {
      plyVertex: {[key:string]: number};
      distance: number;
      index: number;

      constructor(plyVertex: {[key:string]: number}, distance: number, index: number) {
        this.plyVertex = plyVertex;
        this.distance = distance;
        this.index = index;
      }
    }

    const verticesForSort: VertexForSort[] = [];
    for (let i = 0; i < plyVertices.length; i++) {
      const v = plyVertices[i];
      const position = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(viewMatrix);
      const vertexForSort = new VertexForSort(v, position.z, i);
      verticesForSort.push(vertexForSort);
    }

    verticesForSort.sort((a, b) => a.distance - b.distance);
    const glIndices = verticesForSort.map(vertex => vertex.index).map((index) => [
      index * 4 + 0,
      index * 4 + 1,
      index * 4 + 2,
      index * 4 + 0,
      index * 4 + 2,
      index * 4 + 3,
    ]);
    return glIndices;
  }

  let plyVertices: {[key: string]: number}[] | null;
  async function loadGaussianSplatPly() {
    // const plyVertices = await readPlyFile('./gs_FF3_lumix_4k 3.ply');
    plyVertices = await readPlyFile('./gs_FF3_lumix_4k 3.ply');
    if (!plyVertices) {
      fail('Failed to load PLY file');
      return;
    }
    plyVertices = plyVertices.splice(0, 100000);
    // plyVertices = plyVertices.splice(100000, 100);
    // plyVertices = plyVertices.splice(100000, 10000);

    console.log(`plyVertices[0]: ${JSON.stringify(plyVertices[0])}`);
    console.log(`plyVertices.length: ${plyVertices.length}`);

    const quadColors = createQuadColors(plyVertices);
    console.log(`quadColors: ${quadColors.slice(0, 10)}`);

    const plyPositions = new Float32Array(createQuadPositions(plyVertices).flat());
    const plyRotations = new Float32Array(createQuadRotations(plyVertices).flat());
    const plyScales = new Float32Array(createQuadScales(plyVertices).flat());
    const plyUvs = new Float32Array(createQuadUvs(plyVertices).flat());
    const plyColors = new Float32Array(createQuadColors(plyVertices).flat());
    const plyIndices = new Uint32Array(createQuadIndices(plyVertices, new THREE.Matrix4().identity()).flat());

    // console.log(`plyPositions: ${plyPositions}`);
    const plyPositionBuffer = createFloat32Buffer(device, plyPositions, GPUBufferUsage.VERTEX);
    const plyRotationBuffer = createFloat32Buffer(device, plyRotations, GPUBufferUsage.VERTEX);
    const plyScaleBuffer = createFloat32Buffer(device, plyScales, GPUBufferUsage.VERTEX);
    const plyUvBuffer = createFloat32Buffer(device, plyUvs, GPUBufferUsage.VERTEX);
    const plyColorBuffer = createFloat32Buffer(device, plyColors, GPUBufferUsage.VERTEX);
    const plyIndicesBuffer = createUint32Buffer(device, plyIndices, GPUBufferUsage.INDEX);
    positionBuffer = plyPositionBuffer;
    rotationBuffer = plyRotationBuffer;
    scaleBuffer = plyScaleBuffer;
    uvBuffer = plyUvBuffer;
    colorBuffer = plyColorBuffer;
    indicesBuffer = plyIndicesBuffer;
    indexCount = plyIndices.length;
  }

  loadGaussianSplatPly();

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

    const view = camera.getView();
    const model = new THREE.Matrix4().identity();
    const projection = camera.getProjection();
    view.multiply(model).toArray(modelViewValues);
    projection.toArray(projectionValues);
    camera.getModel().toArray(cameraValues);

    device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues);

    if (sortRequested) {
      if (plyVertices) {
        const plyIndices = new Uint32Array(createQuadIndices(plyVertices, camera.getView()).flat());
        const plyIndicesBuffer = createUint32Buffer(device, plyIndices, GPUBufferUsage.INDEX);
        indicesBuffer = plyIndicesBuffer;
        indexCount = plyIndices.length;
      }
      sortRequested = false;
    }

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
    passEncoder.setVertexBuffer(1, rotationBuffer);
    passEncoder.setVertexBuffer(2, scaleBuffer);
    passEncoder.setVertexBuffer(3, uvBuffer);
    passEncoder.setVertexBuffer(4, colorBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, 'uint32');
    passEncoder.drawIndexed(indexCount);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function fail(msg: string) {
  alert(`failed: ${msg}`);
}

export default main;
