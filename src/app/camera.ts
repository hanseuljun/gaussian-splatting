import * as THREE from 'three';

export function getViewProjection(fov: number, aspectRatio: number, near: number, far: number): THREE.Matrix4 {
  // const projection = new THREE.PerspectiveCamera(30, aspectRatio, 0.5, 10).projectionMatrix;
  const projection = new THREE.PerspectiveCamera(fov, aspectRatio, near, far).projectionMatrix;
  const eye = new THREE.Vector3(0, 0, -6);
  const view = new THREE.Matrix4().makeTranslation(eye);
  const viewProjection = projection.multiply(view);
  return viewProjection;
}
