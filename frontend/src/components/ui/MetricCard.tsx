export function MetricCard({
  label,
  value,
  suffix,
  barFraction,
  trend,
}: {
  label: string
  value: string | number
  suffix?: string
  barFraction?: number
  trend?: string
}) {
  const pct = barFraction != null ? Math.min(100, Math.max(0, barFraction * 100)) : null
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/45">
          {label}
        </span>
        {trend && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            {trend}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tighter text-on-surface">{value}</span>
        {suffix && <span className="text-lg font-medium text-on-surface/40">{suffix}</span>}
      </div>
      {pct != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container shadow-[var(--shadow-glow-primary)] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
