import * as THREE from 'three'
import { useMemo } from 'react'
import type { ViewPost } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'

export function ViewPosts3D({ posts, pxPerFt }: { posts: ViewPost[]; pxPerFt: number }) {
  const selectedId = useSigeStore((s) => (s as any).selectedViewPostId as string | null)
  const setSelectedId = useSigeStore((s) => (s as any).setSelectedViewPostId as (id: string | null) => void)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)

  const geo = useMemo(() => new THREE.SphereGeometry(0.12, 14, 12), [])

  return (
    <group>
      {posts.map((p) => {
        const selected = p.id === selectedId
        const x = p.x / pxPerFt
        const z = p.y / pxPerFt
        const y = Math.max(0.2, Number(p.heightFt ?? 4))
        return (
          <mesh
            key={p.id}
            geometry={geo}
            position={[x, y, z]}
            castShadow
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(selected ? null : p.id)
              setSelectedCeilingId(null)
              setSelectedLightId(null)
              setSelectedDoorId(null)
              setSelectedWallId(null)
              setSelectedWindowId(null)
              setSelectedFurnitureId(null)
            }}
          >
            <meshStandardMaterial
              color={selected ? '#22c55e' : '#a855f7'}
              emissive={selected ? '#16a34a' : '#7c3aed'}
              emissiveIntensity={0.35}
              roughness={0.25}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </group>
  )
}

