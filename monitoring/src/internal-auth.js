import { createHmac, timingSafeEqual } from 'node:crypto';
import { internalAdminUserStore, parseInternalAdminBootstrapUsers } from './internal-admin-users.js';

const DEFAULT_TOKEN_COOKIE = 'ops_admin_token';
const DEFAULT_SESSION_COOKIE = 'ops_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ROLE_PERMISSIONS = {
  viewer: new Set(['ops:read']),
  operator: new Set(['ops:read', 'ops:write']),
  admin: new Set(['ops:read', 'ops:write', 'ops:admin'])
};

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), safeDecode(part.slice(index + 1))];
      })
  );
}

function tokenMatches(providedToken, expectedToken) {
  const provided = Buffer.from(String(providedToken || ''));
  const expected = Buffer.from(String(expectedToken || ''));
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function cookieHeader({ cookieName, token, secure, maxAge = SESSION_TTL_SECONDS }) {
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/internal',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader({ cookieName, secure }) {
  const parts = [`${cookieName}=`, 'Path=/internal', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseInternalAdminUsers(rawUsers = '') {
  return parseInternalAdminBootstrapUsers(rawUsers);
}

export function createInternalAdminSession(user, config, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = {
    uid: user.id || null,
    sub: user.username,
    role: user.role,
    display_name: user.display_name || user.username,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS
  };
  const encodedPayload = b64url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, config.internalAdminSessionSecret)}`;
}

export function verifyInternalAdminSession(token, config, now = new Date()) {
  if (!token || !config.internalAdminSessionSecret) return null;
  const [encodedPayload, signature] = String(token).split('.');
  if (!encodedPayload || !signature) return null;
  if (!tokenMatches(signature, signPayload(encodedPayload, config.internalAdminSessionSecret))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (!payload.sub || !payload.role || payload.exp < nowSeconds) return null;
    if (!ROLE_PERMISSIONS[payload.role]) return null;
    return {
      username: payload.sub,
      role: payload.role,
      display_name: payload.display_name || payload.sub,
      auth_type: 'session'
    };
  } catch {
    return null;
  }
}

function principalFromUser(user, authType = 'session') {
  return {
    id: user.id || null,
    username: user.username,
    role: user.role,
    display_name: user.display_name || user.username,
    auth_type: authType,
    disabled_at: user.disabled_at || null,
    last_login_at: user.last_login_at || null
  };
}

export function isOpsPublicRoute({ method, path }) {
  if (method === 'GET' && path === '/internal/ops/login') return true;
  if (method === 'POST' && path === '/internal/ops/session/login') return true;
  return false;
}

export function isOpsProtectedRoute({ method, path }) {
  if (isOpsPublicRoute({ method, path })) return false;
  if (path.startsWith('/internal/ops')) return true;
  if (method === 'POST' && /^\/internal\/article-publish-handoffs\/[^/]+\/ops-action$/.test(path)) return true;
  return false;
}

export function requiredOpsPermission({ method, path }) {
  if (/^\/internal\/ops\/admin-users(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (method === 'GET' && path === '/internal/ops/admin-users') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-views(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-retention(?:\/prune)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-report-archives(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-evidence-case-packet-bundle(?:\/verify)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-evidence-case-packet-bundle-delivery-(?:gate-receipts|handoff-preview|handoff-preview-receipts)(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-policy$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-performance-thresholds$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-sla-alerts(?:\/generate|\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-sla-alert-schedule(?:\/run)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-sla-alert-digests(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-sla-alert-digest-retention-receipts(?:\/[^/]+)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-sla-alert-digest-schedule(?:\/run|\/prune)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (method === 'POST' && /^\/internal\/ops\/audit-evidence-case-packet-bundle-exports\/[^/]+\/review$/.test(path)) {
    return 'ops:admin';
  }
  if (/^\/internal\/ops\/audit-notification-replay-approvals(?:\/cleanup-expired|\/[^/]+(?:\/execute|\/assign|\/workload-action)?)?$/.test(path) && method !== 'GET') {
    return 'ops:admin';
  }
  if (method === 'POST' && /^\/internal\/ops\/audit-notification-deliveries\/[^/]+\/replay-approvals$/.test(path)) {
    return 'ops:admin';
  }
  if (method === 'POST' && /^\/internal\/article-publish-handoffs\/[^/]+\/ops-action$/.test(path)) {
    return 'ops:write';
  }
  if (method === 'POST' && path === '/internal/ops/product-actions') {
    return 'ops:write';
  }
  if (/^\/internal\/ops\/control-center(?:\/settings|\/customers|\/customer-entitlements|\/phase4-entitlements|\/customer-addons|\/smoke-cleanup|\/paid-provider-pilot|\/full-tracking-test)?$/.test(path) && method !== 'GET') {
    return 'ops:write';
  }
  if (method === 'POST' && path === '/internal/ops/prompt-discovery/generate') {
    return 'ops:write';
  }
  if (path.startsWith('/internal/ops')) return 'ops:read';
  return null;
}

export function roleCan(role, permission) {
  if (!permission) return true;
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
}

export function extractInternalAdminToken(request, cookieName = DEFAULT_TOKEN_COOKIE) {
  const headerToken = request.headers['x-internal-admin-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();

  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1].trim();

  const queryToken = request.query?.admin_token || request.query?.internal_admin_token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();

  const cookies = parseCookies(request.headers.cookie);
  return cookies[cookieName] || '';
}

function hasQueryToken(request) {
  return Boolean(request.query?.admin_token || request.query?.internal_admin_token);
}

export async function getInternalAdminPrincipal(request, config, userStore = internalAdminUserStore) {
  const cookies = parseCookies(request.headers.cookie);
  const sessionCookieName = config.internalAdminSessionCookieName || DEFAULT_SESSION_COOKIE;
  const sessionPrincipal = verifyInternalAdminSession(cookies[sessionCookieName], config);
  if (sessionPrincipal) {
    const user = await userStore.resolveSessionUser(sessionPrincipal.username, config.internalAdminUsers);
    if (user) return principalFromUser(user, 'session');
    return null;
  }

  const providedToken = extractInternalAdminToken(request, config.internalAdminCookieName || DEFAULT_TOKEN_COOKIE);
  if (config.internalAdminToken && tokenMatches(providedToken, config.internalAdminToken)) {
    return {
      username: 'token_admin',
      role: 'admin',
      display_name: 'Token Admin',
      auth_type: 'token'
    };
  }
  return null;
}

export function findInternalAdminUser({ username, password }, users) {
  const user = users.find((candidate) => candidate.username === username);
  if (!user) return null;
  if (!tokenMatches(password, user.password)) return null;
  return user;
}

function wantsHtml(request) {
  return String(request.headers.accept || '').includes('text/html') || request.method === 'GET';
}

function loginRedirect(path) {
  return `/internal/ops/login?next=${encodeURIComponent(path)}`;
}

export function registerOpsInternalAuth(app, config, options = {}) {
  const tokenCookieName = config.internalAdminCookieName || DEFAULT_TOKEN_COOKIE;
  const sessionCookieName = config.internalAdminSessionCookieName || DEFAULT_SESSION_COOKIE;
  const userStore = options.userStore || internalAdminUserStore;

  app.addHook('preHandler', async (request, reply) => {
    const path = new URL(request.url, 'http://internal.local').pathname;
    if (!isOpsProtectedRoute({ method: request.method, path })) return;

    if (!config.internalAdminToken && !config.internalAdminSessionSecret) {
      request.log.warn({ path }, 'internal ops auth is disabled; token and session secret are not configured');
      if (config.nodeEnv === 'production') {
        return reply.code(503).send({
          ok: false,
          error: 'internal_admin_auth_not_configured',
          message: 'Internal ops auth must be configured in production.'
        });
      }
      return;
    }

    const principal = await getInternalAdminPrincipal(request, config, userStore);
    if (!principal) {
      if (path === '/internal/ops/dashboard-ui' && wantsHtml(request)) {
        return reply.redirect(loginRedirect(request.url));
      }
      return reply.code(401).send({
        ok: false,
        error: 'internal_admin_auth_required',
        message: 'Internal ops access requires a valid admin session or token.'
      });
    }

    const permission = requiredOpsPermission({ method: request.method, path });
    if (!roleCan(principal.role, permission)) {
      return reply.code(403).send({
        ok: false,
        error: 'internal_admin_permission_denied',
        message: `Role ${principal.role} cannot perform ${permission}.`
      });
    }

    request.internalAdmin = principal;
    if (hasQueryToken(request)) {
      reply.header(
        'set-cookie',
        cookieHeader({
          cookieName: tokenCookieName,
          token: config.internalAdminToken,
          secure: config.nodeEnv === 'production'
        })
      );
    }
  });

  app.get('/internal/ops/login', async (request, reply) => {
    const next = typeof request.query?.next === 'string' ? request.query.next : '/internal/ops/dashboard-ui';
    return reply.type('text/html').send(renderOpsLoginPage({ next }));
  });

  app.post('/internal/ops/session/login', async (request, reply) => {
    const body = request.body || {};
    const user = await userStore.authenticate(
      {
        username: String(body.username || '').trim(),
        password: String(body.password || '')
      },
      config.internalAdminUsers
    );
    if (!user || !config.internalAdminSessionSecret) {
      return reply.code(401).send({
        ok: false,
        error: 'internal_admin_login_failed',
        message: 'Invalid internal admin credentials.'
      });
    }

    const session = createInternalAdminSession(user, config);
    reply.header(
      'set-cookie',
      cookieHeader({
        cookieName: sessionCookieName,
        token: session,
        secure: config.nodeEnv === 'production'
      })
    );
    return {
      ok: true,
      user: {
        username: user.username,
        role: user.role,
        display_name: user.display_name
      }
    };
  });

  app.get('/internal/ops/session', async (request) => {
    return {
      ok: true,
      user: request.internalAdmin
    };
  });

  app.post('/internal/ops/session/logout', async (_request, reply) => {
    reply.header(
      'set-cookie',
      clearCookieHeader({
        cookieName: sessionCookieName,
        secure: config.nodeEnv === 'production'
      })
    );
    return { ok: true };
  });
}

function renderOpsLoginPage({ next }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ops Login</title>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f4ee; color: #151812; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      form { width: min(360px, 100%); background: #fffdf7; border: 1px solid #ded8ca; padding: 24px; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      p { margin: 0 0 18px; color: #62665b; font-size: 14px; line-height: 1.5; }
      label { display: grid; gap: 6px; margin: 14px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #62665b; }
      input { width: 100%; border: 1px solid #cfc8b9; background: white; padding: 11px 12px; font: inherit; }
      button { width: 100%; margin-top: 10px; border: 0; padding: 12px; background: #10231b; color: white; font-weight: 800; cursor: pointer; }
      .error { min-height: 18px; color: #9f1d1d; font-size: 13px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <main>
      <form id="loginForm">
        <h1>Ops login</h1>
        <p>Sign in to access the internal Growth Ops dashboard.</p>
        <label>Username <input name="username" autocomplete="username" required /></label>
        <label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Sign in</button>
        <div class="error" id="error"></div>
      </form>
    </main>
    <script>
      const form = document.querySelector('#loginForm');
      const error = document.querySelector('#error');
      const next = ${JSON.stringify(next)};
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        const data = new FormData(form);
        const response = await fetch('/internal/ops/session/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: data.get('username'),
            password: data.get('password')
          })
        });
        if (!response.ok) {
          error.textContent = 'Invalid username or password.';
          return;
        }
        window.location.href = next || '/internal/ops/dashboard-ui';
      });
    </script>
  </body>
</html>`;
}
