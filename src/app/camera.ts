import * as THREE from 'three';


class Camera {
  fov: number;
  aspectRatio: number;
  near: number;
  far: number;

  constructor(fov: number, aspectRatio: number, near: number, far: number) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
    this.near = near;
    this.far = far;
  }

  getViewProjection(): THREE.Matrix4 {
    const projection = new THREE.PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far).projectionMatrix;
    const eye = new THREE.Vector3(0, 0, -6);
    const view = new THREE.Matrix4().makeTranslation(eye);
    const viewProjection = projection.multiply(view);
    return viewProjection;
  }
}

export default Camera;
