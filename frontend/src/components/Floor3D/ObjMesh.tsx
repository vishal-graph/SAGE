import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'

const FLOOR_CLEARANCE_FT = 0.02

/**
 * Loads OBJ and scales it to match the requested furniture footprint.
 */
export function ObjMesh({
  url,
  widthFt,
  depthFt,
}: {
  url: string
  widthFt: number
  depthFt: number
}) {
  const object = useLoader(OBJLoader, url)
  const { cloned, footprintW, footprintD } = useMemo(() => {
    const c = object.clone(true)

    // Normalize OBJ axis: if exporter used Z-up or X-up, rotate to Y-up.
    const firstBox = new THREE.Box3().setFromObject(c)
    const firstSize = new THREE.Vector3()
    firstBox.getSize(firstSize)
    const absX = Math.abs(firstSize.x)
    const absY = Math.abs(firstSize.y)
    const absZ = Math.abs(firstSize.z)
    if (absZ <= absX && absZ <= absY) {
      c.rotation.x = -Math.PI / 2
    } else if (absX <= absY && absX <= absZ) {
      c.rotation.z = Math.PI / 2
    }

    const b = new THREE.Box3().setFromObject(c)
    const center = new THREE.Vector3()
    b.getCenter(center)
    // Center on X/Z and place bottom on floor (y=0).
    c.position.set(c.position.x - center.x, c.position.y - b.min.y + FLOOR_CLEARANCE_FT, c.position.z - center.z)

    c.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const prev = node.material
        const color =
          prev && !Array.isArray(prev) && 'color' in prev && prev.color instanceof THREE.Color
            ? prev.color
            : new THREE.Color('#9a6a44')
        node.material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
        node.castShadow = true
        node.receiveShadow = true
      }
    })

    const finalBox = new THREE.Box3().setFromObject(c)
    const finalSize = new THREE.Vector3()
    finalBox.getSize(finalSize)
    const footprintW = Math.max(Math.abs(finalSize.x), 1e-6)
    const footprintD = Math.max(Math.abs(finalSize.z), 1e-6)

    return { cloned: c, footprintW, footprintD }
  }, [object])

  const { sx, sy, sz } = useMemo(() => {
    const rawSx = widthFt / footprintW
    const rawSz = depthFt / footprintD
    const sx = Math.min(50, Math.max(0.0001, rawSx))
    const sz = Math.min(50, Math.max(0.0001, rawSz))
    const sy = Math.min(sx, sz)
    return { sx, sy, sz }
  }, [footprintW, footprintD, widthFt, depthFt])

  return <primitive object={cloned} scale={[sx, sy, sz]} />
}
