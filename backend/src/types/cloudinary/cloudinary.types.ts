export interface CloudinaryResponse {
  result: 'ok' | 'error';
  message?: string;
}

export interface CloudinaryResult {
  result: 'ok' | 'error';
  message?: string;
}

export interface CloudinaryDeleteResponse {
  deleted: Record<string, string>;
  deleted_counts: Record<string, { original: number; derived: number }>;
  partial: boolean;
  rate_limit_allowed: number;
  rate_limit_reset_at: string;
  rate_limit_remaining: number;
}