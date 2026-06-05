import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJson, postFormData, postJson } from '../api/client'
import { AuthShell } from '../components/auth/AuthShell'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { MaterialIcon } from '../components/ui/MaterialIcon'
import { useAuth } from '../context/AuthContext'
import type { VendorProfile } from '../types/vendor'

type Step = 'phone' | 'otp' | 'form'

function normalizePhoneInput(raw: string) {
  return raw.replace(/[^\d+]/g, '')
}

function nonEmptyList(xs: string[]) {
  return xs.map((x) => x.trim()).filter(Boolean)
}

export function VendorRegisterPage() {
  const navigate = useNavigate()
  const { vendorOtpSignIn, user } = useAuth()

  const [step, setStep] = useState<Step>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [gstNumber, setGstNumber] = useState('')
  const [additionalGstNumbersRaw, setAdditionalGstNumbersRaw] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [designation, setDesignation] = useState('')
  const [alternativeContactNo, setAlternativeContactNo] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [minBudget, setMinBudget] = useState<string>('')

  const [servicesRaw, setServicesRaw] = useState('')

  const [gstCertificate, setGstCertificate] = useState<File | null>(null)
  const [panCard, setPanCard] = useState<File | null>(null)
  const [cancelledCheque, setCancelledCheque] = useState<File | null>(null)

  const [portfolioByService, setPortfolioByService] = useState<Record<string, File[]>>({})

  const servicesClean = useMemo(() => {
    return nonEmptyList(
      servicesRaw
        .split(/[,\n]/g)
        .map((x) => x.trim())
        .filter(Boolean),
    )
  }, [servicesRaw])

  const additionalGstNumbers = useMemo(() => {
    return nonEmptyList(
      additionalGstNumbersRaw
        .split(/[,\n]/g)
        .map((x) => x.trim())
        .filter(Boolean),
    )
  }, [additionalGstNumbersRaw])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user) return
      if (user.role !== 'vendor') {
        setError('Please use a vendor account for registration.')
        return
      }
      // If already authed as vendor, allow continuing the form (skip OTP).
      if (!cancelled) {
        setPhoneNumber((prev) => prev || user.phone || '')
        setEmail((prev) => prev || user.email || '')
        setStep('form')
      }
      try {
        const profile = await getJson<VendorProfile | null>('/vendor/profile')
        if (!cancelled && profile) {
          navigate('/dashboard', { replace: true })
        }
      } catch {
        // ignore - treat as no profile yet
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, navigate])

  const removeService = (service: string) => {
    setServicesRaw((prev) =>
      nonEmptyList(prev.split(/[,\n]/g))
        .filter((s) => s !== service)
        .join(', '),
    )
    setPortfolioByService((prev) => {
      const next = { ...prev }
      delete next[service]
      return next
    })
  }

  const setPortfolioFiles = (service: string, files: FileList | null) => {
    const list = files ? Array.from(files) : []
    setPortfolioByService((prev) => ({ ...prev, [service]: list }))
  }

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const phone = normalizePhoneInput(phoneNumber)
    if (!phone) {
      setError('Enter your phone number')
      return
    }
    setSubmitting(true)
    try {
      await postJson('/auth/otp/send', { phoneNumber: phone })
      setPhoneNumber(phone)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP')
    } finally {
      setSubmitting(false)
    }
  }

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const phone = normalizePhoneInput(phoneNumber)
    if (!phone) return setError('Enter your phone number')
    if (!otp.trim()) return setError('Enter OTP')
    setSubmitting(true)
    try {
      await vendorOtpSignIn(phone, otp.trim(), email.trim() || undefined)
      setStep('form')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (servicesClean.length < 1) {
      setError('Pick at least one service')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        phone: normalizePhoneInput(phoneNumber),
        email: email.trim(),
        gst_number: gstNumber.trim(),
        additional_gst_numbers: additionalGstNumbers,
        company_name: companyName.trim(),
        company_type: companyType.trim(),
        designation: designation.trim(),
        alternative_contact_no: alternativeContactNo.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim(),
        min_project_budget_inr: Number(minBudget || 0),
        services: servicesClean,
      }

      const form = new FormData()
      form.append('profile_json', JSON.stringify(payload))
      if (gstCertificate) form.append('gst_certificate', gstCertificate)
      if (panCard) form.append('pan_card', panCard)
      if (cancelledCheque) form.append('cancelled_cheque', cancelledCheque)

      for (const [service, files] of Object.entries(portfolioByService)) {
        for (const f of files) {
          // Encode service into filename so backend can group images per service.
          const renamed = new File([f], `${service}__${f.name}`, { type: f.type })
          form.append('portfolio', renamed)
        }
      }

      await postFormData<VendorProfile>('/vendor/profile', form)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vendor profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Vendor registration"
      subtitle="Verify your phone with OTP, then complete your business profile."
      altPrompt="Already registered?"
      altHref="/sp/login"
      altLabel="Sign in"
      compact
    >
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Get started</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Step {step === 'phone' ? 1 : step === 'otp' ? 2 : 3} of 3</p>
        </div>

        {step === 'phone' && (
          <form className="space-y-4" onSubmit={onSendOtp}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Phone number</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="glass-input"
                placeholder="8959896246"
                autoComplete="tel"
                required
              />
            </label>
            <PrimaryButton type="submit" className="w-full justify-center" disabled={submitting}>
              {submitting ? 'Sending OTP...' : 'Send OTP'}
            </PrimaryButton>
            {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
          </form>
        )}

        {step === 'otp' && (
          <form className="space-y-4" onSubmit={onVerifyOtp}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Phone number</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="glass-input"
                placeholder="8959896246"
                autoComplete="tel"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email (for profile)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">OTP</span>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="glass-input"
                placeholder="6-digit OTP"
                inputMode="numeric"
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-on-surface hover:bg-white/15"
                onClick={() => setStep('phone')}
                disabled={submitting}
              >
                Back
              </button>
              <PrimaryButton type="submit" className="flex-1 justify-center" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </PrimaryButton>
            </div>
            <button
              type="button"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-on-surface hover:bg-white/15"
              onClick={async () => {
                setError('')
                const phone = normalizePhoneInput(phoneNumber)
                if (!phone) {
                  setError('Enter your phone number')
                  return
                }
                setSubmitting(true)
                try {
                  await postJson('/auth/otp/send', { phoneNumber: phone })
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to resend OTP')
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting}
            >
              Resend OTP
            </button>
            {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
          </form>
        )}

        {step === 'form' && (
          <form className="space-y-6" onSubmit={onSubmitProfile}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Phone number</span>
                <input type="tel" value={phoneNumber} className="glass-input h-11" disabled />
              </label>
              <label className="block space-y-2 sm:col-span-1 xl:col-span-3">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input h-11"
                  placeholder="you@example.com"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">GST Number</span>
                <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="glass-input h-11" required />
              </label>
              <div className="space-y-2 sm:col-span-1 xl:col-span-3">
                <span className="text-sm font-medium">Additional GST Numbers (optional)</span>
                <input
                  value={additionalGstNumbersRaw}
                  onChange={(e) => setAdditionalGstNumbersRaw(e.target.value)}
                  className="glass-input h-11"
                  placeholder="Add additional GST Nos (comma separated)"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2 sm:col-span-1 xl:col-span-2">
                <span className="text-sm font-medium">Company Name</span>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="glass-input h-11" required />
              </label>
              <label className="block space-y-2 sm:col-span-1 xl:col-span-2">
                <span className="text-sm font-medium">Company Type</span>
                <input
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="glass-input h-11"
                  placeholder="Private Limited"
                  required
                />
              </label>
              <label className="block space-y-2 sm:col-span-1 xl:col-span-2">
                <span className="text-sm font-medium">Designation</span>
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="glass-input h-11"
                  placeholder="Director / Manager"
                  required
                />
              </label>
              <label className="block space-y-2 sm:col-span-1 xl:col-span-2">
                <span className="text-sm font-medium">Alternative Contact No</span>
                <input
                  value={alternativeContactNo}
                  onChange={(e) => setAlternativeContactNo(e.target.value)}
                  className="glass-input h-11"
                  placeholder="8959896246"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Bank Name</span>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="glass-input h-11" placeholder="HDFC Bank" required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Account Number</span>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="glass-input h-11"
                  placeholder="12345678901234"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">IFSC Code</span>
                <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} className="glass-input h-11" placeholder="HDFC0001234" required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Minimum Project Budget (₹)</span>
                <input
                  type="number"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  className="glass-input h-11"
                  placeholder="0"
                  min={0}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Select Services</div>
                <div className="text-xs text-on-surface-variant">Comma separated. Example: Interior Design, False Ceiling</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <input
                  value={servicesRaw}
                  onChange={(e) => setServicesRaw(e.target.value)}
                  className="glass-input h-11 sm:col-span-2 xl:col-span-4"
                  placeholder="Enter services (comma separated)"
                />
              </div>
              {servicesClean.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {servicesClean.map((s) => (
                    <span key={s} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                      {s}
                      <button type="button" onClick={() => removeService(s)} className="opacity-70 hover:opacity-100" title="Remove">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-on-surface-variant">
                  No services selected
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Documents (optional)</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm">GST Certificate</span>
                  <input type="file" onChange={(e) => setGstCertificate(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm">PAN Card</span>
                  <input type="file" onChange={(e) => setPanCard(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm">Cancelled Cheque</span>
                  <input type="file" onChange={(e) => setCancelledCheque(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Portfolio (per service)</div>
                <div className="text-xs text-on-surface-variant">Add multiple images for each offered service.</div>
              </div>
              {servicesClean.length < 1 ? (
                <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-on-surface-variant">
                  Select services above first
                </div>
              ) : (
                <div className="space-y-4">
                  {servicesClean.map((s) => (
                    <div key={s} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">{s}</div>
                        <div className="text-xs text-on-surface-variant">
                          {(portfolioByService[s]?.length ?? 0) > 0 ? `${portfolioByService[s]?.length} selected` : 'No images selected'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-white/15">
                          <MaterialIcon name="add_photo_alternate" className="text-xl" />
                          Add images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => setPortfolioFiles(s, e.target.files)}
                          />
                        </label>
                        <button
                          type="button"
                          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-white/15"
                          onClick={() => setPortfolioByService((prev) => ({ ...prev, [s]: [] }))}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-on-surface hover:bg-white/15"
                onClick={() => setStep('otp')}
                disabled={submitting}
              >
                Back
              </button>
              <PrimaryButton type="submit" className="flex-1 justify-center" disabled={submitting}>
                {submitting ? 'Saving...' : 'Submit'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  )
}

