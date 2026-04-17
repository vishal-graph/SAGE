import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { useAuth } from '../context/AuthContext'

export function SignInPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard'

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(identifier, password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to your workspace"
      subtitle="Access your saved projects, recent activity, and the SIGE editor from one dashboard."
      altPrompt="Need an account?"
      altHref="/sign-up"
      altLabel="Create one"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Use your SIGE account to continue where you left off.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Email or phone</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="glass-input"
              placeholder="you@example.com or +91 98765 43210"
              autoComplete="username"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              placeholder="At least 8 characters"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

          <PrimaryButton type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </PrimaryButton>
        </form>
      </div>
    </AuthShell>
  )
}
