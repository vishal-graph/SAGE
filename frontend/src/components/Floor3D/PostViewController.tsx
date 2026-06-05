import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useSigeStore } from '../../store/useSigeStore'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function PostViewController({ pxPerFt }: { pxPerFt: number }) {
  const active = useSigeStore((s) => (s as any).postViewActive as boolean)
  const selectedId = useSigeStore((s) => (s as any).selectedViewPostId as string | null)
  const posts = useSigeStore((s) => (s as any).viewPosts as import('../../types').ViewPost[])
  const updatePost = useSigeStore((s) => (s as any).updateViewPost as (id: string, patch: Partial<import('../../types').ViewPost>) => void)
  const setPostViewActive = useSigeStore((s) => (s as any).setPostViewActive as (v: boolean) => void)

  const { camera, gl } = useThree()
  const dragging = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const yawRef = useRef<number>(0)
  const pitchRef = useRef<number>(0)

  const post = useMemo(() => (selectedId ? posts.find((p) => p.id === selectedId) : undefined), [posts, selectedId])

  useEffect(() => {
    if (!active || !post) return
    const x = post.x / pxPerFt
    const z = post.y / pxPerFt
    const y = Math.max(0.5, Number(post.heightFt ?? 4))
    camera.position.set(x, y, z)

    yawRef.current = ((Number(post.yawDeg ?? 0) * Math.PI) / 180) % (Math.PI * 2)
    pitchRef.current = clamp(
      (Number(post.pitchDeg ?? 0) * Math.PI) / 180,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05,
    )
    camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ')
  }, [active, post?.id, post?.x, post?.y, post?.heightFt, post?.yawDeg, post?.pitchDeg, camera, pxPerFt])

  useEffect(() => {
    if (!active || !selectedId || !post) return

    const el = gl.domElement

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging.current = true
      last.current = { x: e.clientX, y: e.clientY }
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !last.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }

      yawRef.current = yawRef.current + (dx * 0.18 * Math.PI) / 180
      pitchRef.current = clamp(pitchRef.current - (dy * 0.12 * Math.PI) / 180, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05)
      camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ')
    }

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging.current = false
      last.current = null
      el.releasePointerCapture?.(e.pointerId)
      // Commit final yaw/pitch to store for persistence.
      const yawDeg = ((yawRef.current * 180) / Math.PI) % 360
      const pitchDeg = clamp((pitchRef.current * 180) / Math.PI, -80, 80)
      updatePost(selectedId, { yawDeg, pitchDeg })
    }

    const onDbl = () => {
      // move forward 2ft in facing direction
      const forward = new THREE.Vector3(Math.cos(yawRef.current), 0, Math.sin(yawRef.current))
      const stepFt = 2
      const nx = post.x + forward.x * stepFt * pxPerFt
      const ny = post.y + forward.z * stepFt * pxPerFt
      updatePost(selectedId, { x: nx, y: ny })
      camera.position.set(nx / pxPerFt, camera.position.y, ny / pxPerFt)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPostViewActive(false)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('dblclick', onDbl)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('dblclick', onDbl)
      window.removeEventListener('keydown', onKey)
    }
  }, [active, selectedId, post, gl.domElement, pxPerFt, updatePost, setPostViewActive])

  return null
}

