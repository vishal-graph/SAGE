import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSigeStore } from '../store/useSigeStore'
import { useDerivedGrid } from '../hooks/useDerivedGrid'
import { runCleanFloorplanImageFromStore } from '../utils/runGeminiCleanImage'
import { computeMetricsRemote } from '../api/metrics'
import type { GlobalMetrics, RoomMetrics } from '../types'

type AnalysisActionsValue = {
  runCleanPlan: () => Promise<void>
  runMetrics: () => Promise<void>
  imageUrl: string | null
  aiCleanPlanLoading: boolean
  cleanError: string | null
  cleanHint: string | null
  metricsLoading: boolean
  metricsError: string | null
  globalM: GlobalMetrics | null
  roomM: RoomMetrics[]
  hasDerivedGrid: boolean
}

const AnalysisActionsContext = createContext<AnalysisActionsValue | null>(null)

export function AnalysisActionsProvider({ children }: { children: ReactNode }) {
  const imageUrl = useSigeStore((s) => s.imageUrl)
  const aiCleanPlanLoading = useSigeStore((s) => s.aiCleanPlanLoading)
  const doors = useSigeStore((s) => s.doors)
  const rooms = useSigeStore((s) => s.rooms)
  const minPathWidthFt = useSigeStore((s) => s.minPathWidthFt)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const derived = useDerivedGrid()

  const [cleanError, setCleanError] = useState<string | null>(null)
  const [cleanHint, setCleanHint] = useState<string | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [globalM, setGlobalM] = useState<GlobalMetrics | null>(null)
  const [roomM, setRoomM] = useState<RoomMetrics[]>([])

  const runCleanPlan = useCallback(async () => {
    setCleanError(null)
    setCleanHint(null)
    try {
      const r = await runCleanFloorplanImageFromStore()
      if (!r.ok) {
        setCleanError(r.message)
        return
      }
      setCleanHint(
        `Replaced the floor plan with a ${r.width}×${r.height} clean drawing (walls and doors only, no furniture or labels). Re-upload the original file if you need it back.`,
      )
    } catch (e) {
      setCleanError(e instanceof Error ? e.message : 'Clean plan failed')
    }
  }, [])

  const runMetrics = useCallback(async () => {
    if (!derived) return
    setMetricsLoading(true)
    setMetricsError(null)
    try {
      const minCells = Math.max(1, Math.ceil(minPathWidthFt / gridSizeFt))
      const res = await computeMetricsRemote({
        cols: derived.cols,
        rows: derived.rows,
        cells: derived.cells,
        roomMap: derived.roomMap,
        doors: doors.map((d) => ({ col: d.col, row: d.row })),
        rooms: rooms.map((r, i) => ({ index: i + 1, name: r.name || `Room ${i + 1}` })),
        min_path_width_cells: minCells,
      })
      setGlobalM(res.global_metrics)
      setRoomM(res.room_metrics)
    } catch (e) {
      setMetricsError(e instanceof Error ? e.message : 'Metrics failed')
    } finally {
      setMetricsLoading(false)
    }
  }, [derived, doors, rooms, minPathWidthFt, gridSizeFt])

  const value = useMemo(
    () => ({
      runCleanPlan,
      runMetrics,
      imageUrl,
      aiCleanPlanLoading,
      cleanError,
      cleanHint,
      metricsLoading,
      metricsError,
      globalM,
      roomM,
      hasDerivedGrid: derived != null,
    }),
    [
      runCleanPlan,
      runMetrics,
      imageUrl,
      aiCleanPlanLoading,
      cleanError,
      cleanHint,
      metricsLoading,
      metricsError,
      globalM,
      roomM,
      derived,
    ],
  )

  return (
    <AnalysisActionsContext.Provider value={value}>{children}</AnalysisActionsContext.Provider>
  )
}

export function useAnalysisActions(): AnalysisActionsValue {
  const v = useContext(AnalysisActionsContext)
  if (!v) {
    throw new Error('useAnalysisActions must be used within AnalysisActionsProvider')
  }
  return v
}
