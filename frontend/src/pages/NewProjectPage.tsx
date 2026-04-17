import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJson, postJson } from '../api/client'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SecondaryButton } from '../components/ui/SecondaryButton'
import { useAuth } from '../context/AuthContext'
import { resetSigeWorkspace } from '../store/useSigeStore'
import type { LocationSearchResponse, LocationSuggestion } from '../types/auth'
import { pdfFirstPageToDataUrl } from '../utils/pdf'

function acronymFromLocation(location: string) {
  const cleaned = location
    .split(/[,\s]+/)
    .map((part) => part.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean)
  if (cleaned.length === 0) return ''
  const first = cleaned[0]
  if (first.length <= 4) return first.toUpperCase()
  return first.slice(0, 3).toUpperCase()
}

async function readFloorPlan(file: File) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) {
    const { dataUrl, width, height } = await pdfFirstPageToDataUrl(file)
    return { dataUrl, width, height, filename: file.name }
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, filename: file.name }
}

export function NewProjectPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [customerName, setCustomerName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectNameTouched, setProjectNameTouched] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [projectType, setProjectType] = useState('2BHK')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [budgetRange, setBudgetRange] = useState('10L - 25L')
  const [notes, setNotes] = useState('')
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [locatingCurrent, setLocatingCurrent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const suggestedProjectName = useMemo(() => {
    const parts = [customerName.trim(), acronymFromLocation(selectedLocation?.label || locationQuery), projectType.trim()]
      .filter(Boolean)
      .map((part) => part.trim())
    return parts.join(' ')
  }, [customerName, locationQuery, projectType, selectedLocation])

  useEffect(() => {
    if (!projectNameTouched) setProjectName(suggestedProjectName)
  }, [projectNameTouched, suggestedProjectName])

  const searchLocation = async () => {
    if (!locationQuery.trim()) return
    setSearchingLocation(true)
    setError('')
    try {
      const res = await getJson<LocationSearchResponse>(`/geo/search?q=${encodeURIComponent(locationQuery.trim())}`)
      setSuggestions(res.suggestions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search location')
    } finally {
      setSearchingLocation(false)
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setLocatingCurrent(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setManualLat(String(lat))
        setManualLng(String(lng))
        try {
          const suggestion = await getJson<LocationSuggestion>(`/geo/reverse?lat=${lat}&lng=${lng}`)
          setSelectedLocation(suggestion)
          setLocationQuery(suggestion.label)
          setSuggestions([])
        } catch {
          setSelectedLocation({ label: `Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng })
          setLocationQuery(`Current location (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } finally {
          setLocatingCurrent(false)
        }
      },
      (geoError) => {
        setError(geoError.message || 'Unable to fetch current location')
        setLocatingCurrent(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const project = await postJson<{ project_id: string }>('/project/new', {})
      const floorPlan = floorPlanFile ? await readFloorPlan(floorPlanFile) : null
      const payload = {
        version: '1.0',
        meta: {
          name: projectName.trim() || suggestedProjectName || 'Untitled project',
          created_at: new Date().toISOString(),
          project_intake: {
            customer: {
              name: customerName.trim(),
              phone: phone.trim(),
              email: email.trim(),
            },
            project_type: projectType.trim(),
            budget_range: budgetRange.trim(),
            notes: notes.trim(),
            location: {
              query: locationQuery.trim(),
              label: selectedLocation?.label || locationQuery.trim(),
              lat: Number.isFinite(Number(manualLat)) ? Number(manualLat) : (selectedLocation?.lat ?? null),
              lng: Number.isFinite(Number(manualLng)) ? Number(manualLng) : (selectedLocation?.lng ?? null),
            },
          },
        },
        config: {
          gridSizeFt: 2,
          minPathWidthFt: 2,
          pxPerFt: undefined,
          showFloorPlanImage: true,
          floorPlanRotationDeg: 0,
        },
        scale: undefined,
        image: {
          filename: floorPlan?.filename ?? null,
          dataUrl: floorPlan?.dataUrl ?? null,
          width: floorPlan?.width ?? 0,
          height: floorPlan?.height ?? 0,
        },
        geometry: {
          rooms: [],
          walls: [],
          doors: [],
        },
        furniture: [],
      }
      await postJson('/project/save', { project_id: project.project_id, payload })
      resetSigeWorkspace()
      navigate(`/editor?project=${encodeURIComponent(project.project_id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project')
    } finally {
      setSubmitting(false)
    }
  }

  if (user?.role === 'customer') {
    return (
      <div className="h-dvh overflow-y-auto spatial-grid-bg px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <GlassCard className="space-y-4 p-6 text-center" hoverLift={false}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Access restricted</p>
            <h1 className="text-2xl font-bold tracking-tight">Customers cannot create projects</h1>
            <p className="text-sm text-on-surface-variant">
              Projects are created by vendors. You can review assigned projects, open readonly 3D versions, and share feedback in chat.
            </p>
            <div className="pt-2">
              <SecondaryButton onClick={() => navigate('/dashboard')}>Back to dashboard</SecondaryButton>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh overflow-y-auto spatial-grid-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="floating-card flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Project Creation</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Create a project before entering the editor</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Capture customer details, location, budget, floor plan, and notes first. The editor will open with this project already created.
            </p>
          </div>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Back to dashboard</SecondaryButton>
        </header>

        <form className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" onSubmit={onSubmit}>
          <GlassCard className="space-y-5 p-6" hoverLift={false}>
            <h2 className="text-xl font-semibold">Customer and project details</h2>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Customer name</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="glass-input"
                placeholder="Vishal"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Project name</span>
              <input
                value={projectName}
                onChange={(e) => {
                  setProjectNameTouched(true)
                  setProjectName(e.target.value)
                }}
                className="glass-input"
                placeholder="Auto-generated from customer + location + project type"
                required
              />
              <p className="text-xs text-on-surface/45">Suggested: {suggestedProjectName || 'Fill customer, location, and type to auto-generate'}</p>
            </label>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Customer location</span>
                <input
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value)
                    setSelectedLocation(null)
                  }}
                  className="glass-input"
                  placeholder="Search or type location manually"
                  required
                />
              </label>
              <div className="flex items-end">
                <div className="flex w-full gap-2 md:w-auto">
                  <SecondaryButton className="w-full md:w-auto" onClick={searchLocation} type="button">
                    {searchingLocation ? 'Searching...' : 'Search location'}
                  </SecondaryButton>
                  <SecondaryButton className="w-full md:w-auto" onClick={useCurrentLocation} type="button">
                    {locatingCurrent ? 'Locating...' : 'Use current location'}
                  </SecondaryButton>
                </div>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-surface-container-low/60 p-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(suggestion)
                      setLocationQuery(suggestion.label)
                      setManualLat(String(suggestion.lat))
                      setManualLng(String(suggestion.lng))
                      setSuggestions([])
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/70"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Latitude</span>
                <input
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="glass-input"
                  placeholder="12.9116"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Longitude</span>
                <input
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="glass-input"
                  placeholder="77.6473"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Type of project</span>
                <input
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="glass-input"
                  placeholder="2BHK flat"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Budget range</span>
                <select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} className="glass-input">
                  <option value="Below 10L">Below 10L</option>
                  <option value="10L - 25L">10L - 25L</option>
                  <option value="25L - 50L">25L - 50L</option>
                  <option value="50L - 1Cr">50L - 1Cr</option>
                  <option value="Above 1Cr">Above 1Cr</option>
                  <option value="Custom">Custom</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Customer phone</span>
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
                <span className="text-sm font-medium">Customer email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input"
                  placeholder="customer@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Floor plan</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFloorPlanFile(e.target.files?.[0] ?? null)}
                className="glass-input"
              />
              <p className="text-xs text-on-surface/45">Upload the plan now so the editor opens with it attached.</p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="glass-input min-h-32"
                placeholder="Requirements, preferences, or onboarding notes"
              />
            </label>

            {error && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

            <div className="flex flex-wrap justify-end gap-3">
              <SecondaryButton type="button" onClick={() => navigate('/dashboard')}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? 'Creating project...' : 'Create project and continue'}
              </PrimaryButton>
            </div>
          </GlassCard>

          <GlassCard className="space-y-5 p-6" hoverLift={false}>
            <h2 className="text-xl font-semibold">Preview</h2>
            <div className="space-y-4 rounded-2xl bg-surface-container-low/60 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Project name</p>
                <p className="mt-2 text-lg font-semibold">{projectName || suggestedProjectName || 'Not generated yet'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Customer</p>
                <p className="mt-2 text-sm">{customerName || 'Customer name pending'}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{email || 'Customer email pending'}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{phone || 'Customer phone pending'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Location</p>
                <p className="mt-2 text-sm">{selectedLocation?.label || locationQuery || 'Location pending'}</p>
                {(manualLat || manualLng) && (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {manualLat || 'Lat pending'}, {manualLng || 'Lng pending'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Project type and budget</p>
                <p className="mt-2 text-sm">{projectType || 'Type pending'}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{budgetRange || 'Budget pending'}</p>
              </div>
            </div>
          </GlassCard>
        </form>
      </div>
    </div>
  )
}
