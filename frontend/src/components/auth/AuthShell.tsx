import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  subtitle,
  altPrompt,
  altHref,
  altLabel,
  children,
  compact = false,
}: {
  title: string
  subtitle: string
  altPrompt: string
  altHref: string
  altLabel: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <div className="h-dvh overflow-y-auto spatial-grid-bg px-3 py-4 text-on-surface sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div
        className={[
          'mx-auto grid min-h-full items-start gap-4 sm:gap-6 lg:items-stretch lg:gap-6',
          compact ? 'max-w-7xl lg:grid-cols-[0.9fr_1.1fr]' : 'max-w-6xl lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-8',
        ].join(' ')}
      >
        <section
          className={[
            'rounded-[1.5rem] border border-white/30 bg-white/60 shadow-[var(--shadow-ambient-lg)] backdrop-blur-xl sm:rounded-[2rem]',
            compact ? 'p-5 sm:p-6 lg:p-8' : 'p-5 sm:p-8 lg:p-12',
          ].join(' ')}
        >
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              SIGE Workspace
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
              <p className="max-w-lg text-base leading-7 text-on-surface-variant sm:text-lg">{subtitle}</p>
            </div>
            <div className={compact ? 'hidden' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
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

        <section className={['floating-card mx-auto w-full p-5 sm:p-6 lg:p-8', compact ? 'max-w-3xl' : 'max-w-md'].join(' ')}>
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
