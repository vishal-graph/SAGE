import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { Y_BORDER } from '../floor3DConstants'

/** Outer rectangle matching the raster extent (same as 2D image bounds). */
export function PlanPerimeterLine3D({
  planWidthFt,
  planDepthFt,
}: {
  planWidthFt: number
  planDepthFt: number
}) {
  const pts: THREE.Vector3[] = useMemo(
    () => [
      new THREE.Vector3(0, Y_BORDER, 0),
      new THREE.Vector3(planWidthFt, Y_BORDER, 0),
      new THREE.Vector3(planWidthFt, Y_BORDER, planDepthFt),
      new THREE.Vector3(0, Y_BORDER, planDepthFt),
      new THREE.Vector3(0, Y_BORDER, 0),
    ],
    [planWidthFt, planDepthFt],
  )

  return (
    <Line
      points={pts}
      color="#1e293b"
      lineWidth={2.5}
      dashed={false}
      depthTest
      depthWrite={false}
      renderOrder={2}
    />
  )
}

