import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAnalysisActions } from '../../context/AnalysisActionsContext'
import { PrimaryButton } from '../ui/PrimaryButton'
import { MetricCard } from '../ui/MetricCard'

export function MetricsPanel() {
  const { globalM, roomM, metricsError, runMetrics, metricsLoading, hasDerivedGrid } = useAnalysisActions()

  const chartData = globalM
    ? [
        { name: 'Furniture', v: globalM.furniture_pct * 100 },
        { name: 'Circulation', v: globalM.circulation_pct * 100 },
        { name: 'Dead', v: globalM.dead_pct * 100 },
      ]
    : []

  return (
    <div className="space-y-6">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        <span className="hidden sm:inline">
          Run <span className="font-semibold text-on-surface/70">Metrics</span> from the top bar after calibrating scale
          and drawing rooms.
        </span>
        <span className="sm:hidden">Compute scores after calibrating scale and drawing rooms.</span>
      </p>

      <PrimaryButton
        className="w-full !rounded-xl !py-3 !text-sm sm:hidden"
        disabled={!hasDerivedGrid || metricsLoading}
        onClick={() => void runMetrics()}
      >
        {metricsLoading ? (
          <span className="flex w-full items-center justify-center gap-2">
            <span className="h-4 max-w-[120px] flex-1 overflow-hidden rounded-full shimmer opacity-60" />
            Computing…
          </span>
        ) : (
          'Compute metrics'
        )}
      </PrimaryButton>

      {metricsError && (
        <p className="rounded-xl bg-error/10 px-3 py-2 text-xs font-medium text-error">{metricsError}</p>
      )}

      {globalM && (
        <>
          <MetricCard
            label="Efficiency score"
            value={(globalM.efficiency_score * 100).toFixed(0)}
            suffix="%"
            barFraction={globalM.efficiency_score}
          />

          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface/40">
                  Furniture
                </p>
                <p className="text-xl font-semibold tracking-tight text-on-surface">
                  {(globalM.furniture_pct * 100).toFixed(1)}
                  <span className="text-sm font-medium text-on-surface/40">%</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface/40">
                  Circulation
                </p>
                <p className="text-xl font-semibold tracking-tight text-on-surface">
                  {(globalM.circulation_pct * 100).toFixed(1)}
                  <span className="text-sm font-medium text-on-surface/40">%</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface/40">
                  Dead space
                </p>
                <p className="text-xl font-semibold tracking-tight text-on-surface">
                  {(globalM.dead_pct * 100).toFixed(1)}
                  <span className="text-sm font-medium text-on-surface/40">%</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant">
              Usable {globalM.usable_cells} · Walls {globalM.wall_cells} · Furn cells{' '}
              {globalM.furniture_cells}
            </p>
          </div>

          <div className="h-44 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="color-mix(in srgb, var(--color-outline-variant) 35%, transparent)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#414755' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#414755' }} axisLine={false} tickLine={false} unit="%" width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid color-mix(in srgb, #c1c6d7 25%, transparent)',
                    boxShadow: 'var(--shadow-ambient)',
                  }}
                  formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, '']}
                />
                <Bar dataKey="v" radius={[8, 8, 0, 0]} fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0058bc" />
                    <stop offset="100%" stopColor="#0070eb" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {roomM.length > 0 && (
            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/40">By room</p>
              <ul className="space-y-4">
                {roomM.map((rm) => (
                  <li key={rm.room_index} className="text-sm leading-relaxed text-on-surface-variant">
                    <span className="font-semibold text-on-surface">{rm.name}</span>
                    <span className="text-on-surface/50"> · </span>
                    furn {(rm.furniture_pct * 100).toFixed(0)}% · circ {(rm.circulation_pct * 100).toFixed(0)}%
                    · dead {(rm.dead_pct * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
