export interface CspOptions {
  apiOrigin: string;
  /** Dev server only: Vite injects <style> elements and a react-refresh script. */
  dev?: { styleNonce: string };
}

/**
 * The one Content-Security-Policy: used by `vite preview` (and so by every e2e run) and
 * documented for the CloudFront response headers policy (docs/deployment.md).
 * Report-only until Phase 14. Never 'unsafe-inline': if a component injects styles, use a
 * per-request nonce (plan.md Q17), not 'unsafe-inline'.
 */
export function buildCsp({ apiOrigin, dev }: CspOptions): string {
  const nonce = dev ? ` 'nonce-${dev.styleNonce}'` : '';
  const devSocket = dev ? ' ws://localhost:5173 http://localhost:5173' : '';
  return [
    "default-src 'self'",
    `script-src 'self'${nonce}`,
    `style-src 'self'${nonce}`,
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}${devSocket}`,
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}
