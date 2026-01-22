export interface Article {
  id?: number;
  url: string;
  title: string;
  thumbnail_url?: string;
  author?: string;
  published_at?: string;
  created_at?: string;
  source?: string;
  summary?: string;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  tier?: string;
  is_admin?: boolean;
}

export interface UsageLog {
  action: string;
  count: number;
  limit: number;
}

export interface ApiError {
  detail: string;
}

export interface AccountInfo {
  email: string;
  tier: string;
  is_admin: boolean;
  remaining_reads: number;
  remaining_summaries: number;
  remaining_tts: number;
}
