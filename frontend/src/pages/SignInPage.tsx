import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { useAuth } from '../context/AuthContext'

export function SignInPage() {
  const { signIn, signInWithInviteCode, activateCustomerInvite } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [inviteSignInCode, setInviteSignInCode] = useState('')
  const [signInMode, setSignInMode] = useState<'password' | 'invite'>('password')
  const [inviteName, setInviteName] = useState('')
  const [inviteIdentifier, setInviteIdentifier] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)

  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard'

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (signInMode === 'password') {
        await signIn(identifier, password)
      } else {
        await signInWithInviteCode(identifier, inviteSignInCode.trim().toUpperCase())
      }
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  const onActivateInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInviteError('')
    setActivating(true)
    try {
      await activateCustomerInvite(inviteIdentifier, inviteCode.trim().toUpperCase(), invitePassword, inviteName)
      navigate(destination, { replace: true })
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Unable to activate customer invite')
    } finally {
      setActivating(false)
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
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low/60 p-1">
            <button
              type="button"
              onClick={() => setSignInMode('password')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                signInMode === 'password' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high/60'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setSignInMode('invite')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                signInMode === 'invite' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high/60'
              }`}
            >
              Invite code
            </button>
          </div>

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

          {signInMode === 'password' ? (
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
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-medium">Invite code</span>
              <input
                type="text"
                value={inviteSignInCode}
                onChange={(e) => setInviteSignInCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6))}
                className="glass-input uppercase"
                placeholder="6-digit hex code"
                minLength={6}
                maxLength={6}
                required
              />
            </label>
          )}

          {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

          <PrimaryButton type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Signing in...' : signInMode === 'password' ? 'Sign in with password' : 'Sign in with invite code'}
          </PrimaryButton>
        </form>

        <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 p-4">
          <p className="text-sm font-semibold">Customer first-time access</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Ask your vendor for the 6-digit invite code, then create your password once.
          </p>
          <form className="mt-4 space-y-3" onSubmit={onActivateInvite}>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="glass-input"
              placeholder="Your full name"
              required
            />
            <input
              type="text"
              value={inviteIdentifier}
              onChange={(e) => setInviteIdentifier(e.target.value)}
              className="glass-input"
              placeholder="Email or phone from project intake"
              required
            />
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6))}
              className="glass-input uppercase"
              placeholder="6-digit hex code (e.g. A1B2C3)"
              minLength={6}
              maxLength={6}
              required
            />
            <input
              type="password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              className="glass-input"
              placeholder="Create password (min 8 chars)"
              minLength={8}
              required
            />
            {inviteError && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{inviteError}</p>}
            <PrimaryButton type="submit" className="w-full justify-center" disabled={activating}>
              {activating ? 'Activating...' : 'Create password with invite code'}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </AuthShell>
  )
}
