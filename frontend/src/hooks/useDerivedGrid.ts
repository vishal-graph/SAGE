import { useMemo } from 'react'
import { useSigeStore } from '../store/useSigeStore'
import { computeGrid } from '../utils/gridEngine'

export function useDerivedGrid() {
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)
  const scale = useSigeStore((s) => s.scale)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const rooms = useSigeStore((s) => s.rooms)
  const walls = useSigeStore((s) => s.walls)
  const furniture = useSigeStore((s) => s.furniture)

  return useMemo(() => {
    if (!scale?.pxPerFt || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return null
    return computeGrid({
      imageWidthPx: imageNaturalWidth,
      imageHeightPx: imageNaturalHeight,
      pxPerFt: scale.pxPerFt,
      gridSizeFt,
      rooms,
      walls,
      furniture,
    })
  }, [
    scale,
    imageNaturalWidth,
    imageNaturalHeight,
    gridSizeFt,
    rooms,
    walls,
    furniture,
  ])
}
