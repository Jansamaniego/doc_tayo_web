import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { buildCsp } from '../src/config/csp.ts';

// The Docker files are code too: these specs pin the facts they must keep (plan: docs/docker.md).
const read = (path: string): Promise<string> => readFile(path, 'utf8');

interface Service {
  build?: { context?: string; target?: string };
  ports?: string[];
  profiles?: string[];
  network_mode?: string;
  environment?: Record<string, string>;
  depends_on?: Record<string, { condition: string }>;
  user?: string;
  volumes?: string[];
}
const compose = async (): Promise<{ services: Record<string, Service> }> =>
  parse(await read('compose.yaml')) as { services: Record<string, Service> };

describe('Dockerfile', () => {
  it('uses the same Node major as .nvmrc (one toolchain with the backend)', async () => {
    const [dockerfile, nvmrc] = await Promise.all([read('Dockerfile'), read('.nvmrc')]);
    expect(dockerfile).toContain(`ARG NODE_VERSION=${nvmrc.trim()}`);
  });

  it('has a stage for each job: dev, e2e, build and prod', async () => {
    const dockerfile = await read('Dockerfile');
    for (const stage of ['dev', 'e2e', 'build', 'prod']) {
      expect(dockerfile, stage).toMatch(new RegExp(`^FROM .+ AS ${stage}$`, 'm'));
    }
  });

  it('never runs as root in the stages people run (dev, e2e, prod): the last USER of each is not root', async () => {
    const dockerfile = await read('Dockerfile');
    for (const stage of ['dev', 'e2e', 'prod']) {
      const body =
        dockerfile.split(new RegExp(`^FROM .+ AS ${stage}$`, 'm'))[1]?.split(/^FROM /m)[0] ?? '';
      const users = [...body.matchAll(/^USER (\S+)/gm)].map((match) => match[1]);
      expect(users.length, stage).toBeGreaterThan(0);
      // A stage may switch to root to install system packages, but must end as a normal user.
      expect(users.at(-1), stage).not.toBe('root');
    }
  });

  it('installs the Playwright browsers with their system libraries (so WebKit runs too)', async () => {
    expect(await read('Dockerfile')).toMatch(
      /playwright install --with-deps chromium firefox webkit/,
    );
  });

  it('keeps configuration out of the image: it copies no .env file', async () => {
    expect(await read('Dockerfile')).not.toMatch(/COPY .*\.env/);
  });
});

describe('.dockerignore', () => {
  it('keeps dependencies, build output, git history and local secrets out of the build context', async () => {
    const lines = (await read('.dockerignore')).split('\n').map((line) => line.trim());
    for (const entry of [
      'node_modules',
      'dist',
      'storybook-static',
      'test-results',
      'playwright-report',
      '.git',
      '.env.local',
      '.env.*.local',
    ]) {
      expect(lines, entry).toContain(entry);
    }
  });
});

describe('nginx (the production image and the EC2 fallback)', () => {
  it('sends the same Content-Security-Policy as src/config/csp.ts, with the API origin filled in at start', async () => {
    const template = await read('docker/nginx/default.conf.template');
    // One variable, added in every location: nginx drops server-level headers inside a location that sets its own.
    expect(template).toContain(`set $csp "${buildCsp({ apiOrigin: '${API_ORIGIN}' })}";`);
    expect(
      template.match(/add_header Content-Security-Policy-Report-Only \$csp always;/g)?.length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('serves the single-page app: unknown paths get index.html, which is never cached; hashed files are immutable', async () => {
    const template = await read('docker/nginx/default.conf.template');
    expect(template).toContain('try_files $uri /index.html');
    expect(template).toMatch(/location = \/index\.html[^}]*Cache-Control "no-cache"/s);
    expect(template).toMatch(/location \/assets\/[^}]*max-age=31536000, immutable/s);
  });

  it('sets the other security headers, hides its version and has a health check', async () => {
    const template = await read('docker/nginx/default.conf.template');
    const headers = await read('docker/nginx/security-headers.conf');
    for (const text of [
      'Referrer-Policy "strict-origin-when-cross-origin"',
      'X-Content-Type-Options "nosniff"',
      'Permissions-Policy',
    ]) {
      expect(headers, text).toContain(text);
    }
    for (const text of [
      'server_tokens off',
      'location = /healthz',
      'include /etc/nginx/snippets/security-headers.conf;',
    ]) {
      expect(template, text).toContain(text);
    }
  });
});

describe('compose.yaml', () => {
  it('starts the whole stack by default: database, migrations, API and the dev server', async () => {
    const { services } = await compose();
    for (const name of ['postgres', 'migrate', 'api', 'web']) {
      expect(services[name], name).toBeDefined();
      expect(services[name]?.profiles, name).toBeUndefined();
    }
  });

  it('keeps the tools behind profiles so `up` never starts them', async () => {
    const { services } = await compose();
    expect(services.e2e?.profiles).toContain('e2e');
    expect(services.storybook?.profiles).toContain('storybook');
    expect(services['web-prod']?.profiles).toContain('prod');
    expect(services.seed?.profiles).toContain('tools');
  });

  it('applies migrations before the API starts, and waits for the database', async () => {
    const { services } = await compose();
    expect(services.api?.depends_on?.migrate?.condition).toBe('service_completed_successfully');
    expect(services.migrate?.depends_on?.postgres?.condition).toBe('service_healthy');
  });

  it('publishes every port on this machine only (127.0.0.1), like the backend', async () => {
    const { services } = await compose();
    for (const [name, service] of Object.entries(services)) {
      for (const port of service.ports ?? [])
        expect(port, `${name} ${port}`).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it('lets the API accept the app origins and send the refresh cookie (dev server, e2e preview, production image)', async () => {
    const { services } = await compose();
    const origins = services.api?.environment?.CORS_ALLOWED_ORIGINS ?? '';
    for (const origin of [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:8080',
    ]) {
      expect(origins, origin).toContain(origin);
    }
    expect(services.api?.environment?.CORS_ALLOW_CREDENTIALS).toContain('true');
  });

  it('runs the browser tests inside the API network namespace, so localhost is the API and cookies stay same-site', async () => {
    const { services } = await compose();
    expect(services.e2e?.network_mode).toBe('service:api');
    expect(services.e2e?.depends_on?.api?.condition).toBe('service_healthy');
  });

  it('lets the browser tests read the emails the API writes (the platform admin spec opens the owner setup link)', async () => {
    const { services } = await compose();
    // One named volume: the API writes its emails there (MAIL_TRANSPORT=file), the e2e container reads them.
    const mount = (service: Service | undefined): string | undefined =>
      service?.volumes?.find((volume) => volume.startsWith('mail:'));
    expect(mount(services.api)).toBe('mail:/app/var/mail');
    expect(mount(services.e2e)).toBe('mail:/mail:ro');
    expect(services.e2e?.environment?.E2E_MAIL_DIR).toBe('/mail');
    // Emails stay in the API console by default; the file transport is an opt-in for e2e runs.
    expect(services.api?.environment?.MAIL_TRANSPORT).toBe('${MAIL_TRANSPORT:-log}');
  });

  it('keeps node_modules in a volume, so the host and the container never mix their dependencies', async () => {
    const { services } = await compose();
    expect(services.web?.volumes?.some((volume) => volume.endsWith(':/app/node_modules'))).toBe(
      true,
    );
  });

  it('builds the API from the sibling backend checkout (override with BACKEND_DIR)', async () => {
    const { services } = await compose();
    expect(services.api?.build?.context).toContain('BACKEND_DIR');
  });
});
