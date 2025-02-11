import * as THREE from 'three';


class Camera {
  fov: number;
  aspectRatio: number;
  near: number;
  far: number;
  position: THREE.Vector3;

  constructor(fov: number, aspectRatio: number, near: number, far: number) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
    this.near = near;
    this.far = far;
    this.position = new THREE.Vector3(0, 0, -6);
  }

  getViewProjection(): THREE.Matrix4 {
    const projection = new THREE.PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far).projectionMatrix;
    const view = new THREE.Matrix4().makeTranslation(this.position);
    const viewProjection = projection.multiply(view);
    return viewProjection;
  }
}

export default Camera;
