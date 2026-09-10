import type { CreateLinkPayload, CreateLinkResponse, LinkMetadata, UnlockResponse, StatusReceipt } from '../types';

function getApiBase(): string {
  let base = import.meta.env.VITE_API_BASE_URL || '/api';
  base = base.replace(/\/+$/, '');
  // If user passed origin without /api (e.g. https://backend.up.railway.app), append /api
  if (base.startsWith('http') && !base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

const API_BASE = getApiBase();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch {
      // Non-JSON response fallback
    }
    throw new ApiError(errorMsg, res.status);
  }
  return res.json() as Promise<T>;
}

export async function createLink(payload: CreateLinkPayload): Promise<CreateLinkResponse> {
  const res = await fetch(`${API_BASE}/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateLinkResponse>(res);
}

export async function getLinkMetadata(slug: string): Promise<LinkMetadata> {
  const res = await fetch(`${API_BASE}/links/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<LinkMetadata>(res);
}

export async function unlockLink(slug: string, passcode: string): Promise<UnlockResponse> {
  const res = await fetch(`${API_BASE}/links/${encodeURIComponent(slug)}/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ passcode }),
  });
  return handleResponse<UnlockResponse>(res);
}

export async function getDeliveryStatus(slug: string, token: string): Promise<StatusReceipt> {
  const res = await fetch(`${API_BASE}/status/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<StatusReceipt>(res);
}
