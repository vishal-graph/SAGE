import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJson } from '../api/client'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SecondaryButton } from '../components/ui/SecondaryButton'
import { useAuth } from '../context/AuthContext'
import { resetSigeWorkspace } from '../store/useSigeStore'
import type { DashboardSummaryResponse, ProjectSummary } from '../types/auth'

function formatDate(value?: string | null) {
  if (!value) return 'No timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard className="p-5" hoverLift={false}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface/40">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </GlassCard>
  )
}

function ProjectRow({
  project,
  onOpen,
  onOpenCustomer,
  currentRole,
}: {
  project: ProjectSummary
  onOpen: (projectId: string) => void
  onOpenCustomer: (projectId: string) => void
  currentRole?: 'vendor' | 'customer' | 'supplier'
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/20 bg-white/60 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold">{project.name}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          {project.room_count} rooms · {project.furniture_count} furniture · Updated {formatDate(project.updated_at)}
        </p>
        {(project.customer_name || project.customer_location || project.project_type) && (
          <p className="mt-1 text-sm text-on-surface-variant">
            {[project.customer_name, project.customer_location, project.project_type].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-on-surface/35">{project.project_id}</p>
        {currentRole === 'vendor' && project.invite_code && (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Customer invite code: {project.invite_code}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <SecondaryButton className="w-full sm:w-auto" onClick={() => onOpenCustomer(project.project_id)}>
          {currentRole === 'customer' ? 'Open project' : 'Customer page'}
        </SecondaryButton>
        {currentRole !== 'customer' && (
          <SecondaryButton className="w-full sm:w-auto" onClick={() => onOpen(project.project_id)}>
            Open in editor
          </SecondaryButton>
        )}
      </div>
    </div>
  )
}

export function ProjectDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await getJson<DashboardSummaryResponse>('/project/dashboard')
        if (active) setData(res)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const openProject = (projectId: string) => {
    navigate(`/editor?project=${encodeURIComponent(projectId)}`)
  }

  const openCustomerProject = (projectId: string) => {
    navigate(`/projects/${encodeURIComponent(projectId)}/customer`)
  }

  const startNewProject = () => {
    resetSigeWorkspace()
    navigate('/projects/new')
  }

  const handleSignOut = async () => {
    await signOut()
    resetSigeWorkspace()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="h-dvh overflow-y-auto spatial-grid-bg px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
        <header className="floating-card flex flex-col gap-4 p-4 sm:gap-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Project Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Welcome, {user?.name ?? 'Planner'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Manage your recent SIGE workspaces, continue saved projects, or start a fresh planning session.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
            <SecondaryButton className="w-full sm:w-auto" onClick={() => navigate(user?.role === 'customer' ? '/projects/new' : '/editor')}>
              {user?.role === 'customer' ? 'New request' : 'Open editor'}
            </SecondaryButton>
            <PrimaryButton className="w-full sm:w-auto" onClick={startNewProject}>
              New project
            </PrimaryButton>
            <SecondaryButton className="w-full sm:w-auto" onClick={() => void handleSignOut()}>
              Sign out
            </SecondaryButton>
          </div>
        </header>

        {error && <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Projects" value={data?.total_projects ?? 0} />
          <StatCard label="Rooms" value={data?.total_rooms ?? 0} />
          <StatCard label="Furniture" value={data?.total_furniture ?? 0} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <GlassCard className="space-y-4 p-6" hoverLift={false}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recent projects</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Open a saved workspace or jump into a new plan.</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-24 rounded-2xl shimmer" />
                <div className="h-24 rounded-2xl shimmer" />
              </div>
            ) : data?.recent_projects.length ? (
              <div className="space-y-3">
                {data.recent_projects.map((project) => (
                  <ProjectRow
                    key={project.project_id}
                    project={project}
                    onOpen={openProject}
                    onOpenCustomer={openCustomerProject}
                    currentRole={user?.role}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/40 p-8 text-center">
                <h3 className="text-lg font-semibold">No projects yet</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Create your first project and it will appear here with customer, location, and room details.
                </p>
                <PrimaryButton className="mt-5" onClick={startNewProject}>
                  Create first project
                </PrimaryButton>
              </div>
            )}
          </GlassCard>

          <GlassCard className="space-y-5 p-6" hoverLift={false}>
            <div>
              <h2 className="text-xl font-semibold">Quick actions</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Common next steps after sign-in.</p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={startNewProject}
                className="w-full rounded-2xl bg-primary/8 px-4 py-4 text-left transition hover:bg-primary/12"
              >
                <p className="font-semibold">Start a new project intake</p>
                <p className="mt-1 text-sm text-on-surface-variant">Collect project questions first, then continue into the editor.</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/editor')}
                className="w-full rounded-2xl bg-surface-container-low/70 px-4 py-4 text-left transition hover:bg-surface-container-high/80"
              >
                <p className="font-semibold">Open editor directly</p>
                <p className="mt-1 text-sm text-on-surface-variant">Continue editing in the main SIGE floor-plan workspace.</p>
              </button>
            </div>

            <div className="rounded-2xl bg-surface-container-low/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Account</p>
              <p className="mt-3 text-sm font-semibold">{user?.name}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{user?.email}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{user?.phone}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface/40">{user?.role}</p>
              <p className="mt-3 text-xs text-on-surface/35">Joined {formatDate(user?.created_at)}</p>
            </div>
          </GlassCard>
        </section>
      </div>
    </div>
  )
}
