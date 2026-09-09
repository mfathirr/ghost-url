import type { CreateLinkPayload, CreateLinkResponse, LinkMetadata, UnlockResponse } from '../types';

const API_BASE = '/api';

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
    throw new Error(errorMsg);
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
