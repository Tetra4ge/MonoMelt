import axios from 'axios';

/**
 * Extracts the most useful message from a failed request. The gateway returns
 * `{ message }` (or `{ error }` on older routes); axios's own message is just
 * "Request failed with status code 500".
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || (err.response ? fallback : 'Cannot reach the server. Check your connection.');
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
