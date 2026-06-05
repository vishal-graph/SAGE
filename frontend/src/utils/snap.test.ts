import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { snapToGrid, snapAngle, snapWallEndpoint, type SnapConfig } from './snap'

function v(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z)
}

describe('snapToGrid', () => {
  it('snaps x and z to nearest multiple, preserves y', () => {
    const p = v(1.2, 5, -2.7)
    const out = snapToGrid(p, 1)
    expect(out.x).toBeCloseTo(1)
    expect(out.z).toBeCloseTo(-3)
    expect(out.y).toBe(5)
  })

  it('handles very small grid sizes with clamping', () => {
    const p = v(0.001, 0, 0.001)
    const out = snapToGrid(p, 0.000001)
    // Should not explode / NaN; clamp ensures a reasonable grid.
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
  })
})

describe('snapAngle', () => {
  const anchor = v(0, 0, 0)

  it('locks to 0° (positive X)', () => {
    const out = snapAngle(anchor, v(1, 0, 0.2), Math.PI / 4)
    expect(out.z).toBeCloseTo(0, 4)
    expect(out.x).toBeGreaterThan(0)
  })

  it('locks to 90° (positive Z)', () => {
    const out = snapAngle(anchor, v(0.1, 0, 1), Math.PI / 4)
    expect(out.x).toBeCloseTo(0, 4)
    expect(out.z).toBeGreaterThan(0)
  })

  it('locks to 45°', () => {
    const out = snapAngle(anchor, v(1, 0, 1.1), Math.PI / 4)
    // For 45°, x and z should be equal in magnitude.
    expect(out.x).toBeCloseTo(out.z, 4)
  })

  it('returns original point on zero-length segment', () => {
    const p = v(1, 2, 3)
    const out = snapAngle(p, p, Math.PI / 4)
    expect(out.equals(p)).toBe(true)
  })
})

describe('snapWallEndpoint', () => {
  const baseConfig: SnapConfig = {
    gridSize: 1,
    snapEnabled: true,
    angleLockEnabled: true,
    angleStep: Math.PI / 4,
  }

  it('grid-snaps first endpoint when anchor is null', () => {
    const p = v(1.2, 0, 2.7)
    const { position, snapped } = snapWallEndpoint(null, p, baseConfig)
    expect(snapped).toBe(true)
    expect(position.x).toBeCloseTo(1)
    expect(position.z).toBeCloseTo(3)
    expect(position.y).toBe(0)
  })

  it('angle-locks second endpoint to 0/45/90 degrees', () => {
    const anchor = v(0, 0, 0)
    const p = v(2, 0, 1.9) // near 45°
    const { position } = snapWallEndpoint(anchor, p, baseConfig)
    const angle = Math.atan2(position.z - anchor.z, position.x - anchor.x)
    const snappedAngle = Math.round(angle / baseConfig.angleStep) * baseConfig.angleStep
    expect(angle).toBeCloseTo(snappedAngle, 4)
  })

  it('respects snapEnabled=false even if angleLockEnabled=false', () => {
    const anchor = v(0, 0, 0)
    const p = v(1.2, 0, 3.4)
    const { position, snapped } = snapWallEndpoint(anchor, p, {
      gridSize: 1,
      snapEnabled: false,
      angleLockEnabled: false,
      angleStep: Math.PI / 4,
    })
    expect(snapped).toBe(false)
    expect(position.equals(p)).toBe(true)
  })

  it('handles negative coordinates correctly', () => {
    const anchor = v(-1, 0, -1)
    const p = v(-2.3, 0, -3.7)
    const { position } = snapWallEndpoint(anchor, p, baseConfig)
    expect(Number.isFinite(position.x)).toBe(true)
    expect(Number.isFinite(position.z)).toBe(true)
  })

  it('returns original point when segment length is zero', () => {
    const anchor = v(1, 2, 3)
    const { position, snapped } = snapWallEndpoint(anchor, anchor, baseConfig)
    expect(snapped).toBe(false)
    expect(position.equals(anchor)).toBe(true)
  })
})

