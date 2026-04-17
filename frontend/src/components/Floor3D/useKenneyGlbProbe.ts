import { useEffect, useState } from 'react'
import { allKenneyUrls } from './kenneyModelMap'

function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${normalized}${p}`
}

/**
 * Probes whether at least one mapped Kenney GLB is reachable (dev server / production static).
 */
export function useKenneyGlbReachable(): 'checking' | 'yes' | 'no' {
  const [state, setState] = useState<'checking' | 'yes' | 'no'>('checking')

  useEffect(() => {
    const urls = allKenneyUrls()
    if (urls.length === 0) {
      setState('no')
      return
    }
    let cancelled = false
    ;(async () => {
      for (const u of urls.slice(0, 8)) {
        if (cancelled) return
        try {
          const r = await fetch(publicAssetUrl(u), { method: 'HEAD', cache: 'no-store' })
          if (r.ok) {
            if (!cancelled) setState('yes')
            return
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) setState('no')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
