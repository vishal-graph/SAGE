import type { DerivedGrid } from '../../types'

export interface ValidationResult {
  code: string
  message: string
}

export async function validateLayoutConstraints(
  grid: DerivedGrid,
): Promise<ValidationResult[]> {
  void grid
  throw new Error('Not implemented — AI phase 2')
}
