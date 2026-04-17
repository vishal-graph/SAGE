import type { Tool } from '../../types'
import { MaterialIcon } from './MaterialIcon'

const TOOL_META: Record<
  Tool,
  { icon: string; short: string }
> = {
  select: { icon: 'near_me', short: 'Select' },
  calibrate: { icon: 'straighten', short: 'Scale' },
  room: { icon: 'polyline', short: 'Room' },
  wall: { icon: 'horizontal_rule', short: 'Wall' },
  door: { icon: 'door_front', short: 'Door' },
  placeFurniture: { icon: 'chair', short: 'Place' },
}

export function ToolButton({
  toolId,
  active,
  onClick,
  title,
}: {
  toolId: Tool
  active: boolean
  onClick: () => void
  title?: string
}) {
  const meta = TOOL_META[toolId]
  const label = title ?? meta.short
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all duration-200 ease-out active:scale-90 ${
        active
          ? 'bg-primary/12 text-primary shadow-[0_0_20px_rgba(0,88,188,0.18)] ring-1 ring-primary/20'
          : 'text-on-surface-variant hover:bg-white/50 hover:text-primary'
      }`}
    >
      <MaterialIcon
        name={meta.icon}
        className={`text-[22px] transition-transform duration-200 ${active ? 'icon-fill scale-105' : ''}`}
        filled={active}
      />
      <span className="max-w-[4.5rem] text-center text-[8px] font-bold uppercase tracking-[0.06em]">
        {meta.short}
      </span>
    </button>
  )
}
