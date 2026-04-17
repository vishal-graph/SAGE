import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { useAuth } from '../context/AuthContext'

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'vendor' | 'customer' | 'supplier'>('vendor')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      title="Create your SIGE account"
      subtitle="Set up a personal workspace for project dashboards, saved floor plans, and collaborative planning."
      altPrompt="Already have an account?"
      altHref="/sign-in"
      altLabel="Sign in"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Get started</h2>
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

          <label className="block space-y-2">
            <span className="text-sm font-medium">User type</span>
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="glass-input">
              <option value="vendor">Vendor</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input"
              placeholder="Repeat your password"
              autoComplete="new-password"
              minLength={8}
              required
            />
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
