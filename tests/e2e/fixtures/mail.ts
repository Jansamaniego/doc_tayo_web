import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The API writes each email to a file when it runs with MAIL_TRANSPORT=file (its `var/mail`).
const MAIL_DIR = process.env.E2E_MAIL_DIR ?? '../doc-tayo-api/var/mail';

/** Undoes quoted-printable: soft line breaks and =XX escapes. */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * The `<path>#token=...` link in the newest email sent to `to`, waiting for it to arrive. `path` is the
 * page the link opens: `/account-setup`, `/accept-invitation` or `/verify-email`.
 */
export async function findEmailLink({ to, path }: { to: string; path: string }): Promise<string> {
  const deadline = Date.now() + 20_000;
  const pattern = new RegExp(`https?://[^\\s"')]+${path}#token=[A-Za-z0-9_-]+`);
  while (Date.now() < deadline) {
    const files = (await readdir(MAIL_DIR)).sort().reverse();
    for (const file of files) {
      const body = decodeQuotedPrintable(await readFile(join(MAIL_DIR, file), 'utf8'));
      if (!body.includes(`To: ${to}`)) continue;
      const link = pattern.exec(body);
      if (link) return link[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `No ${path} email for ${to} in ${MAIL_DIR}. Is the API running with MAIL_TRANSPORT=file?`,
  );
}

/** The account-setup link in the newest email sent to `to` (a new clinic owner). */
export function findSetupLink({ to }: { to: string }): Promise<string> {
  return findEmailLink({ to, path: '/account-setup' });
}
