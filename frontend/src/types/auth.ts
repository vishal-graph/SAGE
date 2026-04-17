export interface UserSummary {
  id: string
  email: string
  name: string
  role: 'vendor' | 'customer' | 'supplier'
  phone: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: UserSummary
}

export interface ProjectSummary {
  project_id: string
  name: string
  updated_at: string
  created_at?: string | null
  image_filename?: string | null
  room_count: number
  furniture_count: number
  customer_name?: string | null
  customer_location?: string | null
  project_type?: string | null
  budget_range?: string | null
  access_status?: string | null
  customer_user_id?: string | null
  vendor_user_id?: string | null
}

export interface DashboardSummaryResponse {
  total_projects: number
  total_rooms: number
  total_furniture: number
  recent_projects: ProjectSummary[]
}

export interface ProjectOverviewResponse {
  summary: ProjectSummary
  payload: Record<string, unknown>
}

export interface ShareReadonlyResponse {
  project_id: string
  version_id: string
  shared_at: string
}

export interface SharedReadonlyVersionResponse {
  project_id: string
  version_id: string
  shared_at: string
  shared_by_user_id: string
  payload: Record<string, unknown>
}

export interface ChatAttachment {
  name: string
  content_type: string
  size_bytes: number
  url: string
}

export interface ChatMessage {
  id: string
  project_id: string
  sender_user_id: string
  sender_name: string
  sender_role: string
  body: string
  created_at: string
  attachment?: ChatAttachment | null
}

export interface ChatMessageListResponse {
  messages: ChatMessage[]
}

export interface LinkPreview {
  url: string
  title: string
  description?: string | null
  image_url?: string | null
  site_name?: string | null
}

export interface LinkPreviewResponse {
  preview: LinkPreview
}

export interface LocationSuggestion {
  label: string
  lat: number
  lng: number
}

export interface LocationSearchResponse {
  suggestions: LocationSuggestion[]
}
