import { Suspense, useLayoutEffect } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Y_TEXTURE } from '../floor3DConstants'

/** Floor plan image as XZ plane, aligned with 2D pixel (0,0) → world (0,0). */
function FloorPlanTextureMeshInner({
  url,
  planWidthFt,
  planDepthFt,
}: {
  url: string
  planWidthFt: number
  planDepthFt: number
}) {
  const texture = useTexture(url)
  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
  }, [texture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[planWidthFt / 2, Y_TEXTURE, planDepthFt / 2]} receiveShadow>
      <planeGeometry args={[planWidthFt, planDepthFt]} />
      <meshStandardMaterial map={texture} roughness={0.88} metalness={0.02} />
    </mesh>
  )
}

export function FloorPlanTextureMesh3D({
  url,
  planWidthFt,
  planDepthFt,
}: {
  url: string
  planWidthFt: number
  planDepthFt: number
}) {
  return (
    <Suspense fallback={null}>
      <FloorPlanTextureMeshInner url={url} planWidthFt={planWidthFt} planDepthFt={planDepthFt} />
    </Suspense>
  )
}

