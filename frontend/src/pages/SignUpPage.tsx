import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { MaterialIcon } from '../components/ui/MaterialIcon'
import { useAuth } from '../context/AuthContext'

type Role = 'vendor' | 'customer' | 'supplier'

export function SignUpPage({ portal = 'vendor' }: { portal?: 'vendor' | 'customer' }) {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const forcedRole: Role | null = portal === 'vendor' ? 'vendor' : portal === 'customer' ? 'customer' : null
  const [role, setRole] = useState<Role>(forcedRole ?? 'vendor')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (forcedRole) setRole(forcedRole)
  }, [forcedRole])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await signUp(name, email, phone, password, role)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={portal === 'vendor' ? 'Vendor sign up' : 'Customer sign up'}
      subtitle={
        portal === 'vendor'
          ? 'Create a vendor workspace to manage projects and share read-only versions with customers.'
          : 'Create a customer account to view assigned projects and collaborate via read-only 3D + chat.'
      }
      altPrompt="Already have an account?"
      altHref={portal === 'vendor' ? '/sp/login' : '/us/login'}
      altLabel="Sign in"
    >
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Get started</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Create an account to organize projects before entering the editor.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Full name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input"
              placeholder="Jane Planner"
              autoComplete="name"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="glass-input"
              placeholder="+91 98765 43210"
              autoComplete="tel"
              required
            />
          </label>

          {!forcedRole && (
            <label className="block space-y-2">
              <span className="text-sm font-medium">User type</span>
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="glass-input">
                <option value="vendor">Vendor</option>
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
              </select>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-medium">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input pr-11"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-on-surface-variant hover:bg-white/40 hover:text-primary"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-xl" />
              </button>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Confirm password</span>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input pr-11"
                placeholder="Repeat your password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-on-surface-variant hover:bg-white/40 hover:text-primary"
                onClick={() => setShowConfirmPassword((v) => !v)}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialIcon name={showConfirmPassword ? 'visibility_off' : 'visibility'} className="text-xl" />
              </button>
            </div>
          </label>

          {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

          <PrimaryButton type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </PrimaryButton>
        </form>
      </div>
    </AuthShell>
  )
}
