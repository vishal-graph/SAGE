import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FloorStage } from './Canvas/FloorStage'
import { Floor3DCanvas } from './Floor3D/Floor3DCanvas'
import { Floor3DInspectorPanel } from './Floor3D/Floor3DInspectorPanel'
import { AppLayout } from './layout/AppLayout'
import { BottomHUD } from './layout/BottomHUD'
import { LeftToolDock } from './layout/LeftToolDock'
import { RightFloatingPanels } from './layout/RightFloatingPanels'
import { TopBar } from './layout/TopBar'
import { AnalysisTopBarButtons } from './layout/AnalysisTopBarButtons'
import { AnalysisActionsProvider } from '../context/AnalysisActionsContext'
import { GeminiCleanPlanPanel } from './Dashboard/GeminiCleanPlanPanel'
import { MetricsPanel } from './Dashboard/MetricsPanel'
import { FurnitureLibrary } from './Sidebar/FurnitureLibrary'
import { LayerToggles } from './Sidebar/LayerToggles'
import { ModalWrapper } from './ui/ModalWrapper'
import { PrimaryButton } from './ui/PrimaryButton'
import { SecondaryButton } from './ui/SecondaryButton'
import { AiCleanPlanLoadingOverlay } from './ui/AiCleanPlanLoadingOverlay'
import { MaterialIcon } from './ui/MaterialIcon'
import { useAuth } from '../context/AuthContext'
import { resetSigeWorkspace, useSigeStore } from '../store/useSigeStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { postJson, getJson } from '../api/client'
import type { ShareReadonlyResponse } from '../types/auth'
import { pdfFirstPageToDataUrl } from '../utils/pdf'
export function SigeApp() {
  useKeyboardShortcuts()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

  const [roomDraft, setRoomDraft] = useState<[number, number][]>([])
  const [calModalOpen, setCalModalOpen] = useState(false)
  const [distanceFt, setDistanceFt] = useState('10')
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false)
  const [projectLoadError, setProjectLoadError] = useState('')
  const [loadingProject, setLoadingProject] = useState(false)
  const [sharingReadonly, setSharingReadonly] = useState(false)
  const floorViewMode = useSigeStore((s) => s.floorViewMode)
  const setFloorViewMode = useSigeStore((s) => s.setFloorViewMode)
  const rotateFloorPlan90 = useSigeStore((s) => s.rotateFloorPlan90)
  const floorPlanRotationDeg = useSigeStore((s) => s.floorPlanRotationDeg)

  const fileRef = useRef<HTMLInputElement>(null)
  const resetCanvasViewRef = useRef<(() => void) | null>(null)

  const imageUrl = useSigeStore((s) => s.imageUrl)
  const setImage = useSigeStore((s) => s.setImage)
  const scale = useSigeStore((s) => s.scale)
  const setScale = useSigeStore((s) => s.setScale)
  const setCalibrateStep = useSigeStore((s) => s.setCalibrateStep)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const setGridSizeFt = useSigeStore((s) => s.setGridSizeFt)
  const minPathWidthFt = useSigeStore((s) => s.minPathWidthFt)
  const setMinPathWidthFt = useSigeStore((s) => s.setMinPathWidthFt)
  const addRoom = useSigeStore((s) => s.addRoom)
  const tool = useSigeStore((s) => s.tool)
  const setTool = useSigeStore((s) => s.setTool)
  const projectId = useSigeStore((s) => s.projectId)
  const setProjectId = useSigeStore((s) => s.setProjectId)
  const loadProjectPayload = useSigeStore((s) => s.loadProjectPayload)
  const rooms = useSigeStore((s) => s.rooms)
  const imageFilename = useSigeStore((s) => s.imageFilename)

  const confirmCalibrate = () => {
    if (!scale?.pointA || !scale?.pointB) return
    const dx = scale.pointB[0] - scale.pointA[0]
    const dy = scale.pointB[1] - scale.pointA[1]
    const dPx = Math.hypot(dx, dy)
    const ft = Number(distanceFt)
    if (!Number.isFinite(ft) || ft <= 0 || dPx <= 0) return
    const pxPerFt = dPx / ft
    setScale({
      pxPerFt,
      pointA: scale.pointA,
      pointB: scale.pointB,
    })
    setCalibrateStep(0)
    setCalModalOpen(false)
    setTool('select')
  }

  const cancelCalibrate = () => {
    setCalModalOpen(false)
    setCalibrateStep(1)
  }

  const closeRoom = () => {
    if (roomDraft.length < 3) return
    const id = `room_${Date.now()}`
    const name = `Room ${rooms.length + 1}`
    addRoom({ id, name, polygon: [...roomDraft] })
    setRoomDraft([])
    setTool('select')
  }

  const readFile = async (file: File) => {
    useSigeStore.setState({
      rooms: [],
      walls: [],
      doors: [],
      furniture: [],
      past: [],
      future: [],
      selectedFurnitureId: null,
      scale: null,
      calibrateStep: 0,
      showFloorPlanImage: true,
      aiCleanPlanLoading: false,
      floorViewMode: '2d',
      floorPlanRotationDeg: 0,
    })

    const lower = file.name.toLowerCase()
    if (lower.endsWith('.pdf')) {
      const { dataUrl, width, height } = await pdfFirstPageToDataUrl(file)
      setImage(dataUrl, file.name, width, height)
    } else {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = dataUrl
      })
      setImage(dataUrl, file.name, img.naturalWidth, img.naturalHeight)
    }
  }

  const buildExportPayload = () => ({
    version: '1.0',
    meta: { name: imageFilename ?? 'SIGE project', created_at: new Date().toISOString() },
    config: {
      gridSizeFt,
      minPathWidthFt,
      pxPerFt: scale?.pxPerFt,
      showFloorPlanImage: useSigeStore.getState().showFloorPlanImage,
      floorPlanRotationDeg: useSigeStore.getState().floorPlanRotationDeg,
    },
    scale: scale
      ? { pxPerFt: scale.pxPerFt, pointA: scale.pointA, pointB: scale.pointB }
      : undefined,
    image: {
      filename: imageFilename,
      dataUrl: imageUrl,
      width: useSigeStore.getState().imageNaturalWidth,
      height: useSigeStore.getState().imageNaturalHeight,
    },
    geometry: {
      rooms: useSigeStore.getState().rooms,
      walls: useSigeStore.getState().walls,
      doors: useSigeStore.getState().doors,
    },
    furniture: useSigeStore.getState().furniture,
  })

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(imageFilename ?? 'sige').replace(/\.[^.]+$/, '')}-project.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const saveServer = async () => {
    let id = projectId
    if (!id) {
      const res = await postJson<{ project_id: string }>('/project/new', {})
      id = res.project_id
      setProjectId(id)
    }
    await postJson('/project/save', { project_id: id, payload: buildExportPayload() })
    alert(`Saved as ${id}`)
  }

  const loadServer = async () => {
    const id = prompt('Project ID?')
    if (!id) return
    const data = await getJson<Record<string, unknown>>(`/project/load/${id}`)
    loadProjectPayload(data)
    setProjectId(id)
  }

  const shareReadonlyVersion = async () => {
    if (!projectId) {
      alert('Save this project first to share a readonly version.')
      return
    }
    setSharingReadonly(true)
    try {
      await saveServer()
      const result = await postJson<ShareReadonlyResponse>(`/project/${encodeURIComponent(projectId)}/share-readonly`, {})
      alert(`Readonly version shared.\nVersion: ${result.version_id}\nCustomers can view it from project chat page.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to share readonly version')
    } finally {
      setSharingReadonly(false)
    }
  }

  const triggerUpload = () => fileRef.current?.click()

  useEffect(() => {
    const requestedProjectId = searchParams.get('project')?.trim()
    if (!requestedProjectId || requestedProjectId === projectId) return
    const projectIdToLoad = requestedProjectId

    let active = true
    async function loadRequestedProject() {
      setProjectLoadError('')
      setLoadingProject(true)
      try {
        const data = await getJson<Record<string, unknown>>(`/project/load/${projectIdToLoad}`)
        if (!active) return
        loadProjectPayload(data)
        setProjectId(projectIdToLoad)
      } catch (err) {
        if (!active) return
        setProjectLoadError(err instanceof Error ? err.message : 'Unable to load project')
      } finally {
        if (active) setLoadingProject(false)
      }
    }

    void loadRequestedProject()
    return () => {
      active = false
    }
  }, [searchParams, projectId, loadProjectPayload, setProjectId])

  const roomExtras =
    tool === 'room' ? (
      <>
        <SecondaryButton type="button" disabled={roomDraft.length < 3} onClick={closeRoom}>
          Close room
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => setRoomDraft([])}>
          Clear draft
        </SecondaryButton>
      </>
    ) : undefined

  return (
    <AnalysisActionsProvider>
    <AppLayout>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void readFile(f)
          e.target.value = ''
        }}
      />

      <TopBar
        onUploadClick={triggerUpload}
        onExport={downloadJson}
        onSaveServer={() => void saveServer()}
        onLoadServer={() => void loadServer()}
        onDashboardClick={() => navigate('/dashboard')}
        onShareReadonlyClick={() => void shareReadonlyVersion()}
        showShareReadonlyButton={user?.role === 'vendor'}
        onMessagesClick={() => {
          if (!projectId) {
            alert('Save this project first to open messages.')
            return
          }
          navigate(`/projects/${encodeURIComponent(projectId)}/customer`)
        }}
        showMessagesButton={user?.role === 'vendor'}
        analysisControls={<AnalysisTopBarButtons />}
      />
      {sharingReadonly && (
        <div className="fixed right-6 top-20 z-[60] rounded-xl border border-outline-variant/25 bg-white/95 px-4 py-2 text-sm text-on-surface shadow-[var(--shadow-ambient)]">
          Sharing readonly version...
        </div>
      )}

      <LeftToolDock />

      <main className="relative h-dvh w-full pb-28 pl-2 pr-2 pt-16 lg:pl-24 lg:pr-[22rem]">
        <div className="relative h-[calc(100dvh-11rem)] w-full min-h-0">
          {(loadingProject || projectLoadError) && (
            <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 flex-col gap-2">
              {loadingProject && (
                <div className="rounded-xl border border-outline-variant/25 bg-white/90 px-4 py-2 text-sm font-medium text-on-surface shadow-sm backdrop-blur-md">
                  Loading project...
                </div>
              )}
              {projectLoadError && (
                <div className="rounded-xl border border-error/20 bg-white/95 px-4 py-3 text-sm text-error shadow-sm backdrop-blur-md">
                  {projectLoadError}
                </div>
              )}
            </div>
          )}
          {imageUrl && (
            <div
              className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-outline-variant/25 bg-white/90 p-0.5 shadow-sm backdrop-blur-md"
              role="tablist"
              aria-label="Floor view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={floorViewMode === '2d'}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  floorViewMode === '2d'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high/80'
                }`}
                onClick={() => setFloorViewMode('2d')}
              >
                2D
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={floorViewMode === '3d'}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  floorViewMode === '3d'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high/80'
                }`}
                onClick={() => setFloorViewMode('3d')}
              >
                3D
              </button>
              {floorViewMode === '2d' && (
                <>
                  <span className="mx-0.5 h-5 w-px shrink-0 bg-outline-variant/35" aria-hidden />
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high/80 active:scale-95"
                    title={`Rotate floor plan 90° (${floorPlanRotationDeg}°)`}
                    aria-label={`Rotate floor plan 90 degrees, currently ${floorPlanRotationDeg} degrees`}
                    onClick={() => rotateFloorPlan90()}
                  >
                    <MaterialIcon name="rotate_right" className="text-xl" />
                  </button>
                </>
              )}
            </div>
          )}
          {!imageUrl && (
            <div className="group absolute inset-0 z-10 m-auto flex h-fit max-w-md flex-col items-center gap-6 rounded-[2rem] p-10 text-center transition-all duration-300">
              <span className="absolute -inset-1 rounded-[2.1rem] bg-gradient-to-r from-primary/20 to-primary-container/20 opacity-40 blur-lg transition duration-500 group-hover:opacity-70" />
              <span className="relative flex flex-col items-center gap-6 rounded-[2rem] border border-outline-variant/20 bg-white/75 p-10 shadow-[var(--shadow-ambient-lg)] backdrop-blur-xl transition duration-300 group-hover:scale-[1.01] active:scale-[0.98]">
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-low text-primary/50">
                  <MaterialIcon name="cloud_upload" className="text-5xl" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-on-surface">Upload floor plan</h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                    PDF (first page), PNG, or JPG. Calibrate scale, draw rooms, place furniture, run analysis.
                  </p>
                </div>
                <button type="button" onClick={triggerUpload} className="primary-button">
                  Browse files
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    resetSigeWorkspace()
                    setSearchParams({})
                  }}
                  className="secondary-button"
                >
                  New blank project
                </button>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/30">
                  Spatial Glass workspace
                </span>
              </span>
            </div>
          )}

          {floorViewMode === '2d' ? (
            <FloorStage
              roomDraft={roomDraft}
              setRoomDraft={setRoomDraft}
              onRequestCalibrateDistance={() => setCalModalOpen(true)}
              onRegisterViewControls={(api) => {
                resetCanvasViewRef.current = api.reset
              }}
            />
          ) : (
            <div className="h-full w-full overflow-hidden rounded-2xl bg-white ring-1 ring-outline-variant/15">
              <Floor3DCanvas className="h-full w-full" />
            </div>
          )}
          <AiCleanPlanLoadingOverlay />
        </div>
      </main>

      <RightFloatingPanels />

      <BottomHUD
        gridSizeFt={gridSizeFt}
        minPathWidthFt={minPathWidthFt}
        onGridSizeChange={setGridSizeFt}
        onMinPathChange={setMinPathWidthFt}
        roomToolExtras={roomExtras}
        onResetView={() => resetCanvasViewRef.current?.()}
        onOpenMobilePanels={() => setMobilePanelsOpen(true)}
      />

      {mobilePanelsOpen && (
        <div
          className="fixed inset-0 z-[150] flex flex-col bg-on-surface/20 backdrop-blur-md lg:hidden"
          role="dialog"
          aria-modal
        >
          <div className="flex items-center justify-between border-b border-white/20 bg-white/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-sm font-semibold text-on-surface">Panels</span>
            <button
              type="button"
              className="rounded-xl p-2 text-on-surface-variant hover:bg-white/60"
              onClick={() => setMobilePanelsOpen(false)}
            >
              <MaterialIcon name="close" className="text-xl" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="floating-card space-y-6 p-4">
              <GeminiCleanPlanPanel />
              <MetricsPanel />
            </div>
            <div className="floating-card p-4">
              <FurnitureLibrary />
            </div>
            <div className="floating-card p-4">
              <LayerToggles />
            </div>
            {floorViewMode === '3d' && (
              <div className="floating-card p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">
                  3D properties
                </p>
                <Floor3DInspectorPanel />
              </div>
            )}
          </div>
        </div>
      )}

      <ModalWrapper
        open={calModalOpen}
        onClose={cancelCalibrate}
        title="Calibrate scale"
        icon="straighten"
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Two points are set on the plan. Enter the real-world distance between them (feet).
            </p>
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-outline">
              Distance (ft)
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={distanceFt}
              onChange={(e) => setDistanceFt(e.target.value)}
              className="glass-input text-lg font-medium"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={cancelCalibrate}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={confirmCalibrate}>
              Apply calibration
            </PrimaryButton>
          </div>
        </div>
      </ModalWrapper>
    </AppLayout>
    </AnalysisActionsProvider>
  )
}
