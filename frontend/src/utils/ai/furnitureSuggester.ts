import type { FurnitureItem } from '../../types'
import type { Room } from '../../types'

export async function suggestFurnitureForRoom(
  room: Room,
  areaSqFt: number,
): Promise<FurnitureItem[]> {
  void room
  void areaSqFt
  throw new Error('Not implemented — AI phase 2')
}
