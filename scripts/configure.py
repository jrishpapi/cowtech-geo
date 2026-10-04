#!/usr/bin/env python3
"""Generate local instance secrets once. Never copies host/provider credentials."""
import argparse
import base64
import getpass
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--admin-email', required=True)
parser.add_argument('--admin-user', default='admin')
parser.add_argument('--url', default='http://localhost:18088')
parser.add_argument('--port', type=int, default=18088)
args = parser.parse_args()
for value in [args.admin_email, args.admin_user, args.url]:
    if any(c in value for c in '\r\n\x00\'"\\$'):
        parser.error('Configuration values contain unsupported characters')
if not 1024 <= args.port <= 65535:
    parser.error('Port must be between 1024 and 65535')
if '@' not in args.admin_email or not args.url.startswith(('http://', 'https://')):
    parser.error('A valid email and http(s) URL are required')
targets = [root / '.env', root / 'config/workbench.env', root / 'config/monitoring.env']
if any(p.exists() for p in targets):
    parser.error('Configuration already exists; refusing to overwrite instance keys or passwords')
password = getpass.getpass('New administrator password (12+ characters): ')
if len(password) < 12 or any(c in password for c in '\r\n\x00\'\\'):
    parser.error('Password must be 12+ characters without newlines, single quotes or backslashes')
if password != getpass.getpass('Repeat password: '):
    parser.error('Passwords do not match')
os.umask(0o077)
(root / 'config').mkdir(mode=0o700, exist_ok=True)
wb_db, mon_db, token = [secrets.token_hex(32) for _ in range(3)]
app_key = base64.b64encode(secrets.token_bytes(32)).decode()
base = f'''COMPOSE_PROJECT_NAME=cowtech-geo
WEB_PORT={args.port}
WORKBENCH_DB_PASSWORD={wb_db}
MONITORING_DB_PASSWORD={mon_db}
'''
wb = f'''APP_NAME="CowTech GEO"
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:{app_key}
APP_URL={args.url}
APP_LOCALE=zh_CN
APP_FALLBACK_LOCALE=en
LOG_CHANNEL=stderr
LOG_LEVEL=info
DB_CONNECTION=pgsql
DB_HOST=workbench-db
DB_PORT=5432
DB_DATABASE=workbench
DB_USERNAME=workbench
DB_PASSWORD={wb_db}
REDIS_CLIENT=phpredis
REDIS_HOST=workbench-redis
REDIS_PORT=6379
REDIS_QUEUE_RETRY_AFTER=360
QUEUE_CONNECTION=redis
CACHE_STORE=database
SESSION_DRIVER=database
SESSION_COOKIE=cowtech_session
SESSION_SECURE_COOKIE={'true' if args.url.startswith('https:') else 'false'}
FILESYSTEM_DISK=local
BROADCAST_CONNECTION=null
GEOFLOW_ADMIN_USERNAME={args.admin_user}
GEOFLOW_ADMIN_EMAIL={args.admin_email}
GEOFLOW_ADMIN_PASSWORD='{password}'
GEOFLOW_UPDATE_CHECK_ENABLED=false
GEOFLOW_UPDATE_METADATA_URL=
BOOST_BROWSER_LOGS_WATCHER=false
COWTECH_DEPLOYMENT_MODE=self_hosted
COWTECH_SELF_HOSTED_PLAN_CODE=god
COWTECH_API_BASE_URL=
AIVGL_DASHBOARD_BASE_URL=http://monitoring:18090
AIVGL_INTERNAL_ADMIN_TOKEN={token}
AIVGL_CUSTOMER_PROVIDER_MODE=unconfigured
AIVGL_CUSTOMER_ALLOW_PAID_PROVIDER=false
AIVGL_CUSTOMER_MONITORING_ALLOW_PAID_PROVIDER=false
AIVGL_DEEP_ARTICLE_PROVIDER_MODE=unconfigured
MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
MAIL_FROM_NAME="CowTech GEO"
'''
mon = f'''NODE_ENV=production
PORT=18090
DATABASE_URL=postgres://monitoring:{mon_db}@monitoring-db:5432/monitoring
REDIS_URL=redis://monitoring-redis:6379/0
INTERNAL_ADMIN_TOKEN={token}
INTERNAL_ADMIN_SESSION_SECRET={secrets.token_hex(32)}
INTERNAL_ADMIN_USERS=
EXTERNAL_SPEND_MODE=deny
SCHEDULER_ENABLED=false
SCHEDULER_PROVIDER_MODE=unconfigured
SCHEDULER_ALLOW_PAID_PROVIDER=false
LIVE_PROVIDER_TESTING_ENABLED=false
OPENROUTER_API_KEY=
PERPLEXITY_API_KEY=
SERPAPI_API_KEY=
GEFLOW_API_BASE_URL=
GEFLOW_API_TOKEN=
'''
for path, content in zip(targets, [base, wb, mon]):
    with path.open('x') as handle:
        handle.write(content)
    path.chmod(0o600)
print('Local configuration created with fresh instance keys. No provider credentials configured.')
