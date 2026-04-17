import { useLayoutEffect, useRef } from 'react'
import { Grid } from '@react-three/drei'
import type { ComponentProps } from 'react'
import type { Mesh } from 'three'

type GridProps = ComponentProps<typeof Grid>

/** drei Grid is decorative only — avoids stealing pointer hits from the floor interaction plane. */
export function GridNoRaycast(props: GridProps) {
  const ref = useRef<Mesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    m.raycast = () => {}
  }, [])
  return <Grid ref={ref} {...props} />
}
