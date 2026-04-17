import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function SecondaryButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={`secondary-button ${className}`} {...props}>
      {children}
    </button>
  )
}
