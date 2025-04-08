import * as THREE from 'three';


class Camera {
  fov: number;
  aspectRatio: number;
  near: number;
  far: number;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;

  constructor(fov: number, aspectRatio: number, near: number, far: number) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
    this.near = near;
    this.far = far;
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Quaternion(0, 0, 0, 1);
  }

  getModel(): THREE.Matrix4 {
    const translationMatrix = new THREE.Matrix4().makeTranslation(this.position);
    const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(this.rotation);
    const model = translationMatrix.multiply(rotationMatrix);
    return model;
  }

  getView(): THREE.Matrix4 {
    const view = this.getModel().invert();
    return view;
  }

  getProjection(): THREE.Matrix4 {
    const camera = new THREE.PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far);
    return camera.projectionMatrix;
  }

  move(dx: number, dy: number, dz: number) {
    const dp = new THREE.Vector3(dx, dy, dz);
    this.position.add(dp.applyQuaternion(this.rotation));
  }

  rotate(dq: THREE.Quaternion) {
    this.rotation = this.rotation.multiply(dq);
  }
}

export default Camera;
