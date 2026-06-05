import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { horizontalFootprintMeters, scaleKenneyToTargetFt } from './kenneyGlbScale'

const FLOOR_CLEARANCE_FT = 0.02

/**
 * Scales Kenney GLB to target width/depth (ft) on X/Z; Y uses uniform min(sx,sz).
 * Footprint uses the two largest AABB axes (avoids paper-thin Z); unit divisor corrects cm/mm GLBs.
 */
export function KenneyGlbMesh({
  url,
  widthFt,
  depthFt,
  genericAsset = false,
}: {
  url: string
  widthFt: number
  depthFt: number
  genericAsset?: boolean
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    const b = new THREE.Box3().setFromObject(c)
    const center = new THREE.Vector3()
    b.getCenter(center)
    if (genericAsset) {
      // Normalize to Y-up for non-Kenney GLBs that may come from other DCC tools.
      const s = new THREE.Vector3()
      b.getSize(s)
      const absX = Math.abs(s.x)
      const absY = Math.abs(s.y)
      const absZ = Math.abs(s.z)
      if (absZ <= absX && absZ <= absY) c.rotation.x = -Math.PI / 2
      else if (absX <= absY && absX <= absZ) c.rotation.z = Math.PI / 2

      const b2 = new THREE.Box3().setFromObject(c)
      const center2 = new THREE.Vector3()
      b2.getCenter(center2)
      // Center on X/Z and place bottom at floor.
      c.position.set(c.position.x - center2.x, c.position.y - b2.min.y + FLOOR_CLEARANCE_FT, c.position.z - center2.z)
    } else {
      // Kenney assets should also sit on floor (not be centered through it).
      c.position.set(c.position.x - center.x, c.position.y - b.min.y + FLOOR_CLEARANCE_FT, c.position.z - center.z)
    }
    return c
  }, [scene, genericAsset])
  const { sx, sy, sz } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(cloned)
    if (genericAsset) {
      const s = new THREE.Vector3()
      b.getSize(s)
      const rawW = Math.max(Math.abs(s.x), 1e-6)
      const rawD = Math.max(Math.abs(s.z), 1e-6)
      const rawSx = widthFt / rawW
      const rawSz = depthFt / rawD
      const sx = Math.min(50, Math.max(0.0001, rawSx))
      const sz = Math.min(50, Math.max(0.0001, rawSz))
      const sy = Math.min(sx, sz)
      return { sx, sy, sz }
    }
    const { wM, dM } = horizontalFootprintMeters(b)
    return scaleKenneyToTargetFt(wM, dM, widthFt, depthFt)
  }, [cloned, widthFt, depthFt, genericAsset])

  return <primitive object={cloned} scale={[sx, sy, sz]} />
}
