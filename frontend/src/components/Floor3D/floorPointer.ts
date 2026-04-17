import * as THREE from 'three'

const _ndc = new THREE.Vector2()
const _ray = new THREE.Raycaster()
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _out = new THREE.Vector3()

/** Ray from client coords to intersection with y=0 plane; writes into `target` xz world position (y=0). */
export function intersectFloorXZ(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  domElement: HTMLElement,
  target: THREE.Vector3,
): boolean {
  const rect = domElement.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  _ndc.set(x, y)
  _ray.setFromCamera(_ndc, camera)
  const hit = _ray.ray.intersectPlane(_plane, _out)
  if (hit == null) return false
  target.copy(_out)
  return true
}
