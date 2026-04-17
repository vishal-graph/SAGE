import { createContext, useContext } from 'react'

export const Floor3DOrbitContext = createContext<(enabled: boolean) => void>(() => {})

export function useSetFloor3DOrbit() {
  return useContext(Floor3DOrbitContext)
}
