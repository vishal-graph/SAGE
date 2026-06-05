import { useMemo } from 'react'
import * as THREE from 'three'
import { planPxToWorldXZ } from './planCoordinates'

export function SnapIndicator3D({
  planX,
  planY,
  pxPerFt,
}: {
  planX: number
  planY: number
  pxPerFt: number
}) {
  const { x, z } = useMemo(() => planPxToWorldXZ(planX, planY, pxPerFt), [planX, planY, pxPerFt])
  const geometry = useMemo(() => new THREE.RingGeometry(0.05, 0.08, 16), [])
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshBasicMaterial color={0x00ff88} transparent opacity={0.95} />
    </mesh>
  )
}

