import { Edges } from '@react-three/drei'
import * as THREE from 'three'

const _edgeColor = new THREE.Color('#2563eb')

/** Simple slab for GLB fallback / loading; Y is up, footprint on XZ. */
export function FootprintFallback({
  widthFt,
  depthFt,
  yVisible,
  fill = 'rgba(70,150,240,0.45)',
  showEdges = false,
}: {
  widthFt: number
  depthFt: number
  /** Default: ~⅓ of smaller plan dimension so the slab reads like real furniture height */
  yVisible?: number
  fill?: string
  showEdges?: boolean
}) {
  const h =
    yVisible ??
    Math.max(1.35, Math.min(Math.min(widthFt, depthFt) * 0.38, Math.max(widthFt, depthFt) * 0.22))
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[widthFt, h, depthFt]} />
      <meshStandardMaterial color={fill} transparent opacity={0.92} roughness={0.55} metalness={0.05} />
      {showEdges && <Edges color={_edgeColor.getHex()} threshold={15} />}
    </mesh>
  )
}
