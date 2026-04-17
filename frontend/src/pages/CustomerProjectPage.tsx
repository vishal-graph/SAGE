import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { appendAuthToken, createAuthedWebSocket, getApiBase, getJson, postFile, postJson } from '../api/client'
import { GlassCard } from '../components/ui/GlassCard'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { SecondaryButton } from '../components/ui/SecondaryButton'
import { useAuth } from '../context/AuthContext'
import type { ChatMessage, ChatMessageListResponse, LinkPreview, LinkPreviewResponse, ProjectOverviewResponse } from '../types/auth'

function formatDate(value?: string | null) {
  if (!value) return 'No timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function getAttachmentHref(url: string) {
  return appendAuthToken(`${getApiBase()}${url.replace(/^\/api/, '')}`)
}

function isImageAttachment(contentType?: string | null) {
  return Boolean(contentType && contentType.startsWith('image/'))
}

function isPdfAttachment(contentType?: string | null) {
  return contentType === 'application/pdf'
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s<>'"]+/g) ?? []
}

function renderMessageText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>'"]+)/g)
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      <span key={`text-${index}`}>{part}</span>
    ),
  )
}

export function CustomerProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [error, setError] = useState('')
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview | null>>({})
  const listRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [overviewRes, messagesRes] = await Promise.all([
          getJson<ProjectOverviewResponse>(`/project/${projectId}/overview`),
          getJson<ChatMessageListResponse>(`/project/${projectId}/messages`),
        ])
        if (!active) return
        setOverview(overviewRes)
        setMessages(messagesRes.messages)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load project')
      } finally {
        if (active) setLoading(false)
      }
    }
    if (projectId) void load()
    return () => {
      active = false
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    const ws = createAuthedWebSocket(`/project/ws/projects/${encodeURIComponent(projectId)}`)
    setConnectionState('connecting')
    ws.onopen = () => setConnectionState('live')
    ws.onclose = () => setConnectionState('offline')
    ws.onerror = () => setConnectionState('offline')
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; message?: ChatMessage }
        if (payload.type === 'message' && payload.message) {
          setMessages((current) =>
            current.some((item) => item.id === payload.message!.id) ? current : [...current, payload.message!],
          )
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    }
    return () => {
      ws.close()
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    const urlsToLoad = messages
      .map((message) => ({ messageId: message.id, url: extractUrls(message.body)[0] }))
      .filter((entry): entry is { messageId: string; url: string } => Boolean(entry.url))
      .filter((entry) => !(entry.messageId in linkPreviews))

    if (urlsToLoad.length === 0) return

    void Promise.all(
      urlsToLoad.map(async ({ messageId, url }) => {
        try {
          const result = await getJson<LinkPreviewResponse>(
            `/project/${projectId}/link-preview?url=${encodeURIComponent(url)}`,
          )
          if (!cancelled) {
            setLinkPreviews((current) => ({ ...current, [messageId]: result.preview }))
          }
        } catch {
          if (!cancelled) {
            setLinkPreviews((current) => ({ ...current, [messageId]: null }))
          }
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [linkPreviews, messages, projectId])

  const onSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!draft.trim()) return
    setSending(true)
    try {
      const message = await postJson<ChatMessage>(`/project/${projectId}/messages`, { body: draft })
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message')
    } finally {
      setSending(false)
    }
  }

  const onUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const message = await postFile<ChatMessage>(`/project/${projectId}/attachments`, selectedFile)
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]))
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload file')
    } finally {
      setUploading(false)
    }
  }

  const intake = (overview?.payload.meta as { project_intake?: Record<string, unknown> } | undefined)?.project_intake as
    | Record<string, unknown>
    | undefined
  const customer = (intake?.customer as Record<string, string> | undefined) ?? {}
  const location = (intake?.location as Record<string, string | number | null> | undefined) ?? {}
  const notes = typeof intake?.notes === 'string' ? intake.notes : ''

  const counterpartLabel = useMemo(() => {
    if (!user) return 'Participant'
    return user.role === 'vendor' ? customer.name || 'Customer' : 'Vendor'
  }, [user, customer.name])

  return (
    <div className="h-dvh overflow-hidden spatial-grid-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 overflow-hidden">
        <header className="floating-card flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Customer Project Page</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{overview?.summary.name ?? 'Project'}</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Live discussion between vendor and customer with project overview always visible.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SecondaryButton onClick={() => navigate('/dashboard')}>Back to dashboard</SecondaryButton>
            {user?.role === 'vendor' && (
              <PrimaryButton onClick={() => navigate(`/editor?project=${encodeURIComponent(projectId)}`)}>Open editor</PrimaryButton>
            )}
          </div>
        </header>

        {error && <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard className="space-y-5 overflow-hidden p-6 lg:sticky lg:top-6 lg:self-start" hoverLift={false}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Overview</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                  connectionState === 'live'
                    ? 'bg-primary/10 text-primary'
                    : connectionState === 'connecting'
                      ? 'bg-surface-container-high text-on-surface-variant'
                      : 'bg-error/10 text-error'
                }`}
              >
                {connectionState}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-20 rounded-2xl shimmer" />
                <div className="h-20 rounded-2xl shimmer" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-surface-container-low/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Customer</p>
                  <p className="mt-2 text-lg font-semibold">{customer.name || overview?.summary.customer_name || 'Customer'}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{customer.email || 'No email added'}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{customer.phone || 'No phone added'}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Project details</p>
                  <p className="mt-2 text-sm">{overview?.summary.project_type || 'Project type not set'}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{overview?.summary.budget_range || 'Budget not set'}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{String(location.label || overview?.summary.customer_location || 'Location not set')}</p>
                  <p className="mt-2 text-xs text-on-surface/40">Updated {formatDate(overview?.summary.updated_at)}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface/40">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{notes || 'No notes yet.'}</p>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="flex min-h-0 flex-1 flex-col overflow-hidden p-0" hoverLift={false}>
            <div className="border-b border-outline-variant/20 px-6 py-4">
              <h2 className="text-xl font-semibold">{counterpartLabel} chat</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Discord-style live updates for this project conversation.</p>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low/40 p-6 text-sm text-on-surface-variant">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.sender_user_id === user?.id
                  const attachmentHref = message.attachment ? getAttachmentHref(message.attachment.url) : ''
                  const preview = linkPreviews[message.id]
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isOwn ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface'}`}>
                        <div className={`mb-1 flex items-center gap-2 text-xs ${isOwn ? 'text-white/80' : 'text-on-surface/50'}`}>
                          <span className="font-semibold">{message.sender_name}</span>
                          <span className="uppercase tracking-[0.14em]">{message.sender_role}</span>
                          <span>{formatDate(message.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">{renderMessageText(message.body)}</p>
                        {message.attachment && (
                          <a
                            href={attachmentHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-3 block rounded-xl border px-3 py-2 text-sm ${
                              isOwn ? 'border-white/20 bg-white/10 text-white' : 'border-outline-variant/30 bg-white/60 text-primary'
                            }`}
                          >
                            {isImageAttachment(message.attachment.content_type) && (
                              <img
                                src={attachmentHref}
                                alt={message.attachment.name}
                                className="mb-3 max-h-64 w-full rounded-lg object-cover"
                                loading="lazy"
                              />
                            )}
                            {isPdfAttachment(message.attachment.content_type) && (
                              <iframe
                                src={attachmentHref}
                                title={message.attachment.name}
                                className="mb-3 h-72 w-full rounded-lg bg-white"
                              />
                            )}
                            <span className="block font-semibold">{message.attachment.name}</span>
                            <span className={`text-xs ${isOwn ? 'text-white/70' : 'text-on-surface/50'}`}>
                              {Math.max(1, Math.round(message.attachment.size_bytes / 1024))} KB
                            </span>
                          </a>
                        )}
                        {preview && (
                          <a
                            href={preview.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-3 block overflow-hidden rounded-xl border ${
                              isOwn ? 'border-white/20 bg-white/10 text-white' : 'border-outline-variant/30 bg-white/70 text-on-surface'
                            }`}
                          >
                            {preview.image_url && (
                              <img src={preview.image_url} alt={preview.title} className="h-36 w-full object-cover" loading="lazy" />
                            )}
                            <div className="p-3">
                              <p className={`text-xs uppercase tracking-[0.14em] ${isOwn ? 'text-white/70' : 'text-on-surface/50'}`}>
                                {preview.site_name || new URL(preview.url).hostname}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold">{preview.title}</p>
                              {preview.description && (
                                <p className={`mt-1 line-clamp-3 text-xs ${isOwn ? 'text-white/75' : 'text-on-surface/60'}`}>
                                  {preview.description}
                                </p>
                              )}
                            </div>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <form onSubmit={onSend} className="border-t border-outline-variant/20 px-6 py-4">
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="glass-input min-h-24 w-full"
                  placeholder="Type a message..."
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="glass-input max-w-sm"
                  />
                  <SecondaryButton type="button" onClick={onUpload} disabled={!selectedFile || uploading}>
                    {uploading ? 'Uploading...' : 'Upload file'}
                  </SecondaryButton>
                  {selectedFile && <span className="text-sm text-on-surface-variant">{selectedFile.name}</span>}
                  <div className="ml-auto flex items-end">
                    <PrimaryButton type="submit" disabled={sending || !draft.trim()}>
                      {sending ? 'Sending...' : 'Send'}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
