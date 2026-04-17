import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getJson } from '../api/client'
import { Floor3DCanvas } from '../components/Floor3D/Floor3DCanvas'
import { SecondaryButton } from '../components/ui/SecondaryButton'
import { useSigeStore } from '../store/useSigeStore'
import type { SharedReadonlyVersionResponse } from '../types/auth'

export function ReadOnlyProject3DPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [versionId, setVersionId] = useState('')
  const [sharedAt, setSharedAt] = useState('')
  const loadProjectPayload = useSigeStore((s) => s.loadProjectPayload)
  const setProjectId = useSigeStore((s) => s.setProjectId)
  const setFloorViewMode = useSigeStore((s) => s.setFloorViewMode)

  useEffect(() => {
    let active = true
    async function loadReadonly() {
      setLoading(true)
      setError('')
      try {
        const result = await getJson<SharedReadonlyVersionResponse>(
          `/project/${encodeURIComponent(projectId)}/shared-readonly`,
        )
        if (!active) return
        loadProjectPayload(result.payload)
        setProjectId(result.project_id)
        setFloorViewMode('3d')
        setVersionId(result.version_id)
        setSharedAt(result.shared_at)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load readonly version')
      } finally {
        if (active) setLoading(false)
      }
    }
    if (projectId) void loadReadonly()
    return () => {
      active = false
    }
  }, [loadProjectPayload, projectId, setFloorViewMode, setProjectId])

  return (
    <div className="h-dvh overflow-hidden spatial-grid-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
        <header className="floating-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Readonly 3D Project Share</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {versionId ? `Version ${versionId} · Shared ${new Date(sharedAt).toLocaleString()}` : 'Loading shared version'}
            </p>
            <p className="mt-1 text-xs text-on-surface/60">
              This view is read-only. Use feedback chat to send suggestions to the vendor.
            </p>
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => navigate(`/projects/${encodeURIComponent(projectId)}/customer`)}>
              Give feedback in chat
            </SecondaryButton>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-outline-variant/20 bg-white/80 shadow-[var(--shadow-ambient)]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">Loading 3D view...</div>
            ) : (
              <Floor3DCanvas className="h-full w-full" readOnly />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
