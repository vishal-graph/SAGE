import type { ReactNode } from 'react'
import { MaterialIcon } from '../ui/MaterialIcon'
import { SecondaryButton } from '../ui/SecondaryButton'

interface TopBarProps {
  onUploadClick: () => void
  onExport: () => void
  onSaveServer: () => void
  onLoadServer: () => void
  onDashboardClick?: () => void
  onMessagesClick?: () => void
  showMessagesButton?: boolean
  onShareReadonlyClick?: () => void
  showShareReadonlyButton?: boolean
  analysisControls?: ReactNode
}

export function TopBar({
  onUploadClick,
  onExport,
  onSaveServer,
  onLoadServer,
  onDashboardClick,
  onMessagesClick,
  showMessagesButton,
  onShareReadonlyClick,
  showShareReadonlyButton,
  analysisControls,
}: TopBarProps) {
  const tbSecondary =
    '!box-border !h-9 !min-h-9 !max-h-9 !shrink-0 !rounded-lg !border !px-2.5 !py-0 !text-xs !font-medium !leading-none !gap-1.5 hover:!translate-y-0 hover:!shadow-none active:!scale-[0.98]'
  const tbIcon = `${tbSecondary} !w-9 !min-w-9 !max-w-9 !p-0`
  const tbRule = 'hidden h-6 w-px shrink-0 bg-outline-variant/35 sm:block'

  return (
    <nav className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-2 sm:px-4">
      <div
        className="pointer-events-auto isolate grid w-full max-w-7xl grid-cols-2 items-center gap-x-2 rounded-xl border border-white/25 bg-white/70 px-3 py-2 shadow-[var(--shadow-ambient)] backdrop-blur-md transition-shadow duration-200 hover:shadow-[var(--shadow-ambient-lg)] md:gap-x-3 md:[grid-template-columns:minmax(0,1fr)_auto_minmax(0,1.55fr)]"
        style={{ borderColor: 'color-mix(in srgb, var(--color-outline-variant) 18%, transparent)' }}
      >
        {/* Left third: clip so content cannot paint over the center title */}
        <div className="relative z-0 min-w-0 overflow-hidden">
          <div className="flex h-9 min-h-9 min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain sm:gap-3">
            <span className="inline-flex h-9 shrink-0 items-center text-sm font-bold leading-none tracking-tight text-on-surface">
              SIGE
            </span>
            <div className="hidden h-9 shrink-0 items-center gap-1 sm:flex">
              {onDashboardClick && (
                <button
                  type="button"
                  onClick={onDashboardClick}
                  className="inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold leading-none text-primary underline decoration-primary/30 decoration-1 underline-offset-2 transition-colors hover:bg-primary/5 active:scale-[0.98]"
                >
                  Dashboard
                </button>
              )}
              <SecondaryButton className={tbSecondary} type="button" onClick={onUploadClick}>
                <MaterialIcon name="upload_file" className="!text-lg leading-none text-on-surface-variant" />
                Plan
              </SecondaryButton>
            </div>
          </div>
        </div>
        {/* Center third: above z-0 sides so primary glow / overflow never reads as “behind” the title */}
        <div className="relative z-[1] hidden h-9 min-h-9 min-w-0 items-center justify-center px-1 md:flex">
          <h1
            className="max-w-full truncate rounded-md bg-white/95 px-2 py-0.5 text-center text-[10px] font-bold leading-none uppercase tracking-[0.18em] text-[#5a5f66] shadow-sm ring-1 ring-outline-variant/20 md:text-[11px] md:tracking-[0.2em]"
            title="Spatial Grid Engine"
          >
            Spatial Grid Engine
          </h1>
        </div>
        {/* Right third: no horizontal scroll — compact actions + wider column so everything fits */}
        <div className="relative z-0 min-w-0 overflow-hidden">
          <div className="flex h-9 min-h-9 min-w-0 flex-nowrap items-center justify-end gap-1">
            {analysisControls}
            <span className={tbRule} aria-hidden />
            <SecondaryButton type="button" className={tbIcon} onClick={onUploadClick} title="Upload">
              <MaterialIcon name="add_photo_alternate" className="text-xl leading-none text-on-surface-variant" />
            </SecondaryButton>
            <SecondaryButton type="button" className={`${tbSecondary} hidden sm:inline-flex`} onClick={onExport} title="Export">
              <MaterialIcon name="download" className="!text-lg leading-none text-on-surface-variant xl:!hidden" />
              <span className="hidden xl:inline">Export</span>
            </SecondaryButton>
            <SecondaryButton type="button" className={`${tbSecondary} hidden sm:inline-flex`} onClick={onSaveServer} title="Save">
              <MaterialIcon name="save" className="!text-lg leading-none text-on-surface-variant xl:!hidden" />
              <span className="hidden xl:inline">Save</span>
            </SecondaryButton>
            {showShareReadonlyButton && onShareReadonlyClick && (
              <SecondaryButton type="button" className={`${tbSecondary} hidden sm:inline-flex`} onClick={onShareReadonlyClick} title="Save and share readonly 3D">
                <MaterialIcon name="share" className="!text-lg leading-none text-on-surface-variant xl:!hidden" />
                <span className="hidden xl:inline">Save & Share</span>
              </SecondaryButton>
            )}
            <SecondaryButton type="button" className={`${tbSecondary} hidden sm:inline-flex`} onClick={onLoadServer} title="Load">
              <MaterialIcon name="folder_open" className="!text-lg leading-none text-on-surface-variant xl:!hidden" />
              <span className="hidden xl:inline">Load</span>
            </SecondaryButton>
            {showMessagesButton && onMessagesClick && (
              <SecondaryButton type="button" className={`${tbSecondary} hidden sm:inline-flex`} onClick={onMessagesClick} title="Messages">
                <MaterialIcon name="chat" className="!text-lg leading-none text-on-surface-variant xl:!hidden" />
                <span className="hidden xl:inline">Messages</span>
              </SecondaryButton>
            )}
            <span className={tbRule} aria-hidden />
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-white/60 hover:text-primary active:scale-95"
              title="Notifications"
            >
              <MaterialIcon name="notifications" className="text-xl leading-none" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
