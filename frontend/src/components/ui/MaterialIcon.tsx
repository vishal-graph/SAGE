export function MaterialIcon({
  name,
  className = '',
  filled = false,
}: {
  name: string
  className?: string
  filled?: boolean
}) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={
        filled
          ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }
          : undefined
      }
      aria-hidden
    >
      {name}
    </span>
  )
}
