import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { MaterialIcon } from '../components/ui/MaterialIcon'
import { useAuth } from '../context/AuthContext'

type Role = 'vendor' | 'customer' | 'supplier'

export function SignInPage({
  portal = 'vendor',
  defaultMode = 'password',
}: {
  portal?: 'vendor' | 'customer'
  defaultMode?: 'password' | 'invite'
}) {
  const { signIn, signInWithInviteCode, activateCustomerInvite } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const forcedRole: Role | null = portal === 'vendor' ? 'vendor' : portal === 'customer' ? 'customer' : null
  const [passwordRole, setPasswordRole] = useState<Role>(forcedRole ?? 'vendor')
  const [inviteSignInCode, setInviteSignInCode] = useState('')
  const [signInMode, setSignInMode] = useState<'password' | 'invite'>(defaultMode)
  const [inviteName, setInviteName] = useState('')
  const [inviteIdentifier, setInviteIdentifier] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [showInvitePassword, setShowInvitePassword] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)

  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard'

  useEffect(() => {
    setSignInMode(defaultMode)
  }, [defaultMode])

  useEffect(() => {
    if (forcedRole) setPasswordRole(forcedRole)
  }, [forcedRole])

  const allowInvite = portal === 'customer'

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (signInMode === 'password') {
        await signIn(identifier, password, passwordRole)
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
      title={portal === 'vendor' ? 'Vendor sign in' : 'Customer sign in'}
      subtitle={
        portal === 'vendor'
          ? 'Vendors manage projects, layouts, and share read-only versions with customers.'
          : 'Customers can sign in with password or use an invite code shared by the vendor.'
      }
      altPrompt="Need an account?"
      altHref={portal === 'vendor' ? '/sp/signup' : '/us/signup'}
      altLabel="Create one"
    >
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome back</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Use your SIGE account to continue where you left off.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {allowInvite && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low/60 p-1">
              <button
                type="button"
                onClick={() => setSignInMode('password')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  signInMode === 'password'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high/60'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setSignInMode('invite')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  signInMode === 'invite'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high/60'
                }`}
              >
                Invite code
              </button>
            </div>
          )}

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

          {signInMode === 'password' && !forcedRole && (
            <label className="block space-y-2">
              <span className="text-sm font-medium">User type</span>
              <select value={passwordRole} onChange={(e) => setPasswordRole(e.target.value as typeof passwordRole)} className="glass-input">
                <option value="vendor">Vendor</option>
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
              </select>
            </label>
          )}

          {signInMode === 'password' ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input pr-11"
                  placeholder="At least 8 characters"
                  autoComplete="current-password"
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

        {portal === 'customer' && (
          <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 p-3.5 sm:p-4">
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
              type={showInvitePassword ? 'text' : 'password'}
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              className="glass-input pr-11"
              placeholder="Create password (min 8 chars)"
              minLength={8}
              required
            />
            <button
              type="button"
              className="relative -mt-[3.1rem] ml-auto block rounded-lg p-2 text-on-surface-variant hover:bg-white/40 hover:text-primary"
              onClick={() => setShowInvitePassword((v) => !v)}
              title={showInvitePassword ? 'Hide password' : 'Show password'}
              aria-label={showInvitePassword ? 'Hide password' : 'Show password'}
              style={{ marginRight: 6 }}
            >
              <MaterialIcon name={showInvitePassword ? 'visibility_off' : 'visibility'} className="text-xl" />
            </button>
            {inviteError && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{inviteError}</p>}
            <PrimaryButton type="submit" className="w-full justify-center" disabled={activating}>
              {activating ? 'Activating...' : 'Create password with invite code'}
            </PrimaryButton>
          </form>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
