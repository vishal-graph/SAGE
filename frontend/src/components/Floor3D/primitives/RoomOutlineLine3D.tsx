import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '../../../types'
import { planPxToWorldXZ } from '../planCoordinates'
import { Y_BORDER } from '../floor3DConstants'

export function RoomOutlineLine3D({ room, pxPerFt }: { room: Room; pxPerFt: number }) {
  const pts = useMemo(() => {
    const poly = room.polygon
    if (poly.length < 2) return []
    const v: THREE.Vector3[] = poly.map(([px, py]) => {
      const p = planPxToWorldXZ(px, py, pxPerFt)
      return new THREE.Vector3(p.x, Y_BORDER + 0.004, p.z)
    })
    if (v.length > 0) v.push(v[0]!.clone())
    return v
  }, [room.polygon, pxPerFt])

  if (pts.length < 3) return null

  return (
    <Line
      points={pts}
      color="#f59e0b"
      lineWidth={2}
      depthTest
      depthWrite={false}
      transparent
      opacity={0.95}
      renderOrder={2}
    />
  )
}

