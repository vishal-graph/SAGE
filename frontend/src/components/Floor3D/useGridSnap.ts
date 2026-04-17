import { useCallback } from 'react'
import { snapDimensionFt, snapScalarToGrid } from './worldFromFurniture'

export function useGridSnap(gridSizeFt: number) {
  const snapFt = useCallback((v: number) => snapScalarToGrid(v, gridSizeFt), [gridSizeFt])
  const snapDim = useCallback((v: number) => snapDimensionFt(v, gridSizeFt), [gridSizeFt])
  return { snapFt, snapDim }
}
