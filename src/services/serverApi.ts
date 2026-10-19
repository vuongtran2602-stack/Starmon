/**
 * Frontend origin for the Express API. Set VITE_SERVER_API_URL when the UI is
 * hosted separately from server.ts; leave it empty when both share an origin.
 */
export function serverApiUrl(path: string): string {
  const configuredOrigin = String((import.meta as any).env?.VITE_SERVER_API_URL || '').trim();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return configuredOrigin
    ? `${configuredOrigin.replace(/\/+$/, '')}${normalizedPath}`
    : normalizedPath;
}

let hasReportedAccountApiIssue = false;

export function reportAccountApiIssue(error: unknown): void {
  if (hasReportedAccountApiIssue) return;
  hasReportedAccountApiIssue = true;
  const configuredOrigin = String((import.meta as any).env?.VITE_SERVER_API_URL || '').trim();
  console.warn(
    `Account API unavailable${configuredOrigin ? ` at ${configuredOrigin}` : ' on the current origin'}. Local saves are retained; configure VITE_SERVER_API_URL to the Express server.ts origin when the UI is hosted separately.`,
    error instanceof Error ? error.message : error,
  );
}
