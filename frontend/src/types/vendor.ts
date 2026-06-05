export interface VendorServicePortfolio {
  service: string
  image_urls: string[]
}

export interface VendorProfile {
  user_id: string
  phone: string
  email: string
  gst_number: string
  additional_gst_numbers: string[]
  company_name: string
  company_type: string
  designation: string
  alternative_contact_no: string
  bank_name: string
  account_number: string
  ifsc_code: string
  min_project_budget_inr: number
  services: string[]
  portfolio: VendorServicePortfolio[]
  documents: Record<string, string | null>
  created_at: string
  updated_at: string
}

