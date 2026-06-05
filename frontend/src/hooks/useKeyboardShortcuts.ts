import { useEffect } from 'react'
import { useSigeStore } from '../store/useSigeStore'

export function useKeyboardShortcuts() {
  const undo = useSigeStore((s) => s.undo)
  const redo = useSigeStore((s) => s.redo)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)
  const moveFurniture = useSigeStore((s) => s.moveFurniture)
  const updateFurniture = useSigeStore((s) => s.updateFurniture)
  const furniture = useSigeStore((s) => s.furniture)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)
  const selectedDoorId = useSigeStore((s) => s.selectedDoorId)
  const removeDoor = useSigeStore((s) => s.removeDoor)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const selectedWindowId = useSigeStore((s) => s.selectedWindowId)
  const removeWindow = useSigeStore((s) => s.removeWindow)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const selectedLightId = useSigeStore((s) => s.selectedLightId)
  const removeLight = useSigeStore((s) => s.removeLight)
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const selectedCeilingId = useSigeStore((s) => s.selectedCeilingId)
  const removeCeiling = useSigeStore((s) => s.removeCeiling)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const walls = useSigeStore((s) => s.walls)
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const setSelectedWallIds = useSigeStore((s) => s.setSelectedWallIds)
  const removeWall = useSigeStore((s) => s.removeWall)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const setSnapToGrid = useSigeStore((s) => s.setSnapToGrid)
  const angleLockEnabled = useSigeStore((s) => s.angleLockEnabled)
  const setAngleLockEnabled = useSigeStore((s) => s.setAngleLockEnabled)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const t = (e.target as HTMLElement | null)?.tagName
      if (t === 'INPUT' || t === 'TEXTAREA') return
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'a' && selectedWallIds.length > 0) {
        e.preventDefault()
        setSelectedWallIds(walls.map((w) => w.id))
      } else if (!mod && e.key.toLowerCase() === 'r' && selectedFurnitureId) {
        e.preventDefault()
        rotateFurniture(selectedFurnitureId)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedFurnitureId) {
        e.preventDefault()
        removeFurniture(selectedFurnitureId)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedDoorId) {
        e.preventDefault()
        removeDoor(selectedDoorId)
        setSelectedDoorId(null)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedWindowId) {
        e.preventDefault()
        removeWindow(selectedWindowId)
        setSelectedWindowId(null)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedLightId) {
        e.preventDefault()
        removeLight(selectedLightId)
        setSelectedLightId(null)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedCeilingId) {
        e.preventDefault()
        removeCeiling(selectedCeilingId)
        setSelectedCeilingId(null)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedWallIds.length > 0) {
        e.preventDefault()
        for (const wallId of selectedWallIds) removeWall(wallId)
        setSelectedWallIds([])
      } else if (!mod && selectedFurnitureId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        const cur = furniture.find((f) => f.id === selectedFurnitureId)
        if (!cur) return
        e.preventDefault()
        const key = e.key.toLowerCase()
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowUp' || key === 'w') dy = -1
        if (e.key === 'ArrowDown' || key === 's') dy = 1
        if (e.key === 'ArrowLeft' || key === 'a') dx = -1
        if (e.key === 'ArrowRight' || key === 'd') dx = 1
        if (dx !== 0 || dy !== 0) {
          moveFurniture(
            cur.id,
            cur.gridX + dx,
            cur.gridY + dy,
            [...cur.freeOffsetPx] as [number, number],
            true,
            { gx: cur.gridX, gy: cur.gridY, off: [...cur.freeOffsetPx] as [number, number] },
          )
        }
      } else if (!mod && selectedFurnitureId && ['q', 'Q', 'e', 'E'].includes(e.key)) {
        const cur = furniture.find((f) => f.id === selectedFurnitureId)
        if (!cur) return
        e.preventDefault()
        const stepFt = e.shiftKey ? 0.5 : 0.25
        const current = Math.max(0, Number(cur.elevationFt ?? 0))
        const next = e.key.toLowerCase() === 'q' ? current + stepFt : Math.max(0, current - stepFt)
        updateFurniture(cur.id, { elevationFt: next }, true)
      } else if (!mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setSnapToGrid(!snapToGrid)
      } else if (!mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setAngleLockEnabled(!angleLockEnabled)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    undo,
    redo,
    rotateFurniture,
    removeFurniture,
    moveFurniture,
    updateFurniture,
    furniture,
    selectedFurnitureId,
    selectedDoorId,
    removeDoor,
    setSelectedDoorId,
    selectedWindowId,
    removeWindow,
    setSelectedWindowId,
    selectedLightId,
    removeLight,
    setSelectedLightId,
    selectedCeilingId,
    removeCeiling,
    setSelectedCeilingId,
    removeWall,
    walls,
    selectedWallIds,
    setSelectedWallIds,
    snapToGrid,
    setSnapToGrid,
    angleLockEnabled,
    setAngleLockEnabled,
  ])
}
