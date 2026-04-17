import { useEffect } from 'react'
import { useSigeStore } from '../store/useSigeStore'

export function useKeyboardShortcuts() {
  const undo = useSigeStore((s) => s.undo)
  const redo = useSigeStore((s) => s.redo)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (!mod && e.key.toLowerCase() === 'r' && selectedFurnitureId) {
        e.preventDefault()
        rotateFurniture(selectedFurnitureId)
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && selectedFurnitureId) {
        const t = (e.target as HTMLElement)?.tagName
        if (t === 'INPUT' || t === 'TEXTAREA') return
        e.preventDefault()
        removeFurniture(selectedFurnitureId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, rotateFurniture, removeFurniture, selectedFurnitureId])
}
