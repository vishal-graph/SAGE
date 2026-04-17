import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  subtitle,
  altPrompt,
  altHref,
  altLabel,
  children,
}: {
  title: string
  subtitle: string
  altPrompt: string
  altHref: string
  altLabel: string
  children: ReactNode
}) {
  return (
    <div className="h-dvh overflow-y-auto spatial-grid-bg px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-white/30 bg-white/60 p-8 shadow-[var(--shadow-ambient-lg)] backdrop-blur-xl sm:p-12">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              SIGE Workspace
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
              <p className="max-w-lg text-base leading-7 text-on-surface-variant sm:text-lg">{subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-container-low/70 p-4">
                <p className="text-sm font-semibold">Project Dashboard</p>
                <p className="mt-2 text-sm text-on-surface-variant">Track recent floor plans, counts, and next actions.</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low/70 p-4">
                <p className="text-sm font-semibold">Secure Sessions</p>
                <p className="mt-2 text-sm text-on-surface-variant">Each user gets their own saved workspace and projects.</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low/70 p-4">
                <p className="text-sm font-semibold">Editor Ready</p>
                <p className="mt-2 text-sm text-on-surface-variant">Jump from the dashboard straight into the existing planner.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="floating-card mx-auto w-full max-w-md p-6 sm:p-8">
          {children}
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {altPrompt}{' '}
            <Link className="font-semibold text-primary hover:underline" to={altHref}>
              {altLabel}
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}
