import { useSigeStore } from '../../store/useSigeStore'
import type { Tool } from '../../types'
import { ToolButton } from '../ui/ToolButton'

const ORDER: Tool[] = ['select', 'calibrate', 'room', 'wall', 'door', 'placeFurniture']

export function LeftToolDock() {
  const tool = useSigeStore((s) => s.tool)
  const setTool = useSigeStore((s) => s.setTool)

  return (
    <aside className="pointer-events-none fixed left-0 top-1/2 z-40 -translate-y-1/2 pl-3 max-lg:pl-2">
      <div
        className="pointer-events-auto flex w-[4.25rem] flex-col items-center gap-1 rounded-2xl border border-white/30 bg-white/60 py-3 shadow-[var(--shadow-ambient)] backdrop-blur-xl"
        style={{ borderColor: 'color-mix(in srgb, var(--color-outline-variant) 18%, transparent)' }}
      >
        <span className="mb-1 text-[8px] font-bold uppercase tracking-widest text-on-surface/35">Tools</span>
        {ORDER.map((id) => (
          <ToolButton key={id} toolId={id} active={tool === id} onClick={() => setTool(id)} />
        ))}
      </div>
    </aside>
  )
}
