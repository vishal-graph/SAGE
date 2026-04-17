import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PrimaryButton({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type={type} className={`primary-button ${className}`} {...props}>
      {children}
    </button>
  )
}
