export interface CreateLinkPayload {
  url: string;
  alias?: string;
  passcode?: string;
  expires_in?: string;
  ttl_seconds?: number;
}

export interface CreateLinkResponse {
  slug: string;
  short_url: string;
  expires_at: string;
  ttl_seconds: number;
  has_passcode: boolean;
}

export interface LinkMetadata {
  slug: string;
  protected: boolean;
  expires_at: string;
  ttl_remaining: number;
}

export interface UnlockResponse {
  url: string;
}

export interface ApiError {
  error: string;
}
