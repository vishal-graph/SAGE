import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { horizontalFootprintMeters, scaleKenneyToTargetFt } from './kenneyGlbScale'

/**
 * Scales Kenney GLB to target width/depth (ft) on X/Z; Y uses uniform min(sx,sz).
 * Footprint uses the two largest AABB axes (avoids paper-thin Z); unit divisor corrects cm/mm GLBs.
 */
export function KenneyGlbMesh({
  url,
  widthFt,
  depthFt,
}: {
  url: string
  widthFt: number
  depthFt: number
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    const b = new THREE.Box3().setFromObject(c)
    const center = new THREE.Vector3()
    b.getCenter(center)
    c.position.sub(center)
    return c
  }, [scene])
  const { sx, sy, sz } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(cloned)
    const { wM, dM } = horizontalFootprintMeters(b)
    return scaleKenneyToTargetFt(wM, dM, widthFt, depthFt)
  }, [cloned, widthFt, depthFt])

  return <primitive object={cloned} scale={[sx, sy, sz]} />
}
