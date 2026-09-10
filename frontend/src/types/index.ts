export type ContentType = 'url' | 'note';

export interface CreateLinkPayload {
  url: string;
  alias?: string;
  passcode?: string;
  duress_passcode?: string;
  expires_in?: string;
  ttl_seconds?: number;
  max_views?: number;
}

export interface CreateLinkResponse {
  slug: string;
  short_url: string;
  expires_at: string;
  ttl_seconds: number;
  has_passcode: boolean;
  max_views?: number;
  status_token?: string;
}

export interface LinkMetadata {
  slug: string;
  protected: boolean;
  expires_at: string;
  ttl_remaining: number;
  max_views?: number;
  views_remaining: number | null;
}

export interface UnlockResponse {
  url: string;
  burned?: boolean;
}

export interface StatusReceipt {
  slug: string;
  status: 'pending' | 'viewed' | 'burned';
  created_at: string;
  expires_at: string;
  viewed_at?: string;
  burned_at?: string;
}

export interface ApiError {
  error: string;
}
