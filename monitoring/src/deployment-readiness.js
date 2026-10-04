import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { getConfig } from './config.js';

const REQUIRED_ENV = [
  { name: 'NODE_ENV', secret: false, required: true, production_required: true, description: 'Runtime environment' },
  { name: 'PORT', secret: false, required: true, production_required: true, description: 'API listen port' },
  { name: 'DATABASE_URL', secret: true, required: true, production_required: true, description: 'Postgres connection string' },
  { name: 'REDIS_URL', secret: true, required: true, production_required: true, description: 'Redis connection string' },
  { name: 'JOB_QUEUE_KEY', secret: false, required: true, production_required: true, description: 'Redis job queue key' },
  { name: 'SCHEDULER_ENABLED', secret: false, required: true, production_required: true, description: 'Scheduler enable flag' },
  { name: 'SCHEDULER_INTERVAL_MS', secret: false, required: true, production_required: true, description: 'Scheduler cadence' },
  { name: 'SCHEDULER_JOB_MODE', secret: false, required: true, production_required: true, description: 'Scheduler job mode' },
  { name: 'SCHEDULER_PROVIDER_MODE', secret: false, required: true, production_required: true, description: 'Scheduler provider mode' },
  { name: 'SCHEDULER_ALLOW_PAID_PROVIDER', secret: false, required: true, production_required: true, description: 'Paid provider scheduler gate' },
  { name: 'INTERNAL_ADMIN_TOKEN', secret: true, required: true, production_required: true, description: 'Internal ops API token' },
  {
    name: 'INTERNAL_ADMIN_SESSION_SECRET',
    secret: true,
    required: true,
    production_required: true,
    description: 'Internal ops session signing secret'
  },
  { name: 'INTERNAL_ADMIN_USERS', secret: true, required: true, production_required: true, description: 'Internal admin bootstrap users' },
  { name: 'OPENROUTER_API_KEY', secret: true, required: false, production_required: false, description: 'R11 paid provider key' },
  { name: 'GEFLOW_API_BASE_URL', secret: false, required: false, production_required: false, description: 'R8.3 live GeoFlow base URL' },
  { name: 'GEFLOW_API_TOKEN', secret: true, required: false, production_required: false, description: 'R8.3 live GeoFlow token' },
  { name: 'GEFLOW_DRY_RUN', secret: false, required: true, production_required: true, description: 'GeoFlow live dispatch gate' }
];

const DEPLOYMENT_COMMANDS = ['wrangler deploy', 'wrangler pages deploy', 'remote docker compose up', 'ssh deploy'];
const REHEARSAL_ASSETS = [
  { key: 'backup_script', path: 'scripts/backup-postgres.sh', required: true },
  { key: 'restore_script', path: 'scripts/restore-postgres.sh', required: true },
  { key: 'migration_runner', path: 'src/migrate.js', required: true },
  { key: 'migration_directory', path: 'db/migrations', required: true },
  { key: 'backup_restore_runbook', path: 'docs/runbooks/backup-restore.md', required: true },
  { key: 'deploy_later_runbook', path: 'docs/runbooks/deploy-later.md', required: true }
];

function readPackageScripts() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return Object.keys(pkg.scripts || {}).sort();
  } catch {
    return [];
  }
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function sourceForEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name) ? 'process.env' : 'default';
}

function envValueForName(config, name) {
  const map = {
    NODE_ENV: config.nodeEnv,
    PORT: config.port,
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: config.redisUrl,
    JOB_QUEUE_KEY: config.jobQueueKey,
    SCHEDULER_ENABLED: config.schedulerEnabled,
    SCHEDULER_INTERVAL_MS: config.schedulerIntervalMs,
    SCHEDULER_JOB_MODE: config.schedulerJobMode,
    SCHEDULER_PROVIDER_MODE: config.schedulerProviderMode,
    SCHEDULER_ALLOW_PAID_PROVIDER: config.schedulerAllowPaidProvider,
    INTERNAL_ADMIN_TOKEN: config.internalAdminToken,
    INTERNAL_ADMIN_SESSION_SECRET: config.internalAdminSessionSecret,
    INTERNAL_ADMIN_USERS: config.internalAdminUsers,
    OPENROUTER_API_KEY: config.openrouterApiKey,
    GEFLOW_API_BASE_URL: config.geoflowApiBaseUrl,
    GEFLOW_API_TOKEN: config.geoflowApiToken,
    GEFLOW_DRY_RUN: config.geoflowDryRun
  };
  return map[name];
}

function envInventory(config) {
  return REQUIRED_ENV.map((item) => {
    const value = envValueForName(config, item.name);
    return {
      name: item.name,
      description: item.description,
      required: item.required,
      production_required: item.production_required,
      secret: item.secret,
      present: present(value),
      source: sourceForEnv(item.name),
      value: item.secret ? (present(value) ? '[redacted]' : null) : value,
      status: item.required && !present(value) ? 'missing' : 'ok'
    };
  });
}

function serviceInventory(config) {
  return [
    {
      key: 'api',
      role: 'HTTP API and dashboards',
      command: 'node src/api.js',
      port: config.port,
      healthcheck: '/ready',
      required_dependencies: ['postgres', 'redis'],
      production_required: true
    },
    {
      key: 'worker',
      role: 'Background job worker',
      command: 'node src/worker.js',
      port: null,
      healthcheck: 'process health plus queue drain',
      required_dependencies: ['postgres', 'redis'],
      production_required: true
    },
    {
      key: 'scheduler',
      role: 'Scheduled job producer',
      command: 'node src/scheduler.js',
      port: null,
      healthcheck: 'process health plus scheduled job audit',
      required_dependencies: ['postgres', 'redis'],
      production_required: true
    },
    {
      key: 'postgres',
      role: 'Primary relational datastore',
      command: 'postgres:16-alpine',
      port: 5432,
      healthcheck: 'pg_isready',
      required_dependencies: [],
      production_required: true
    },
    {
      key: 'redis',
      role: 'Job queue and scheduler coordination',
      command: 'redis:7-alpine',
      port: 6379,
      healthcheck: 'redis-cli ping',
      required_dependencies: [],
      production_required: true
    }
  ];
}

function smokeInventory(scripts) {
  const required = [
    'check',
    'test',
    'smoke',
    'paid-gate:smoke',
    'customer-dashboard:smoke',
    'ops-dashboard:smoke',
    'product-ops-action:smoke',
    'geoflow-readiness:smoke',
    'geoflow-live-gate:smoke',
    'geoflow-callback-import:smoke'
  ];
  return required.map((name) => ({
    name,
    present: scripts.includes(name),
    status: scripts.includes(name) ? 'available' : 'missing'
  }));
}

function assetInventory() {
  const root = new URL('..', import.meta.url);
  return REHEARSAL_ASSETS.map((asset) => ({
    ...asset,
    present: existsSync(new URL(asset.path, root)),
    status: existsSync(new URL(asset.path, root)) ? 'available' : 'missing'
  }));
}

function migrationInventory() {
  try {
    const migrationsDir = new URL('../db/migrations/', import.meta.url);
    const migrations = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    return {
      directory: 'db/migrations',
      present: true,
      total: migrations.length,
      first: migrations[0] || null,
      latest: migrations.at(-1) || null,
      runner: 'npm run migrate',
      idempotency_model: 'schema_migrations table records applied SQL files; already-applied migrations are skipped'
    };
  } catch {
    return {
      directory: 'db/migrations',
      present: false,
      total: 0,
      first: null,
      latest: null,
      runner: 'npm run migrate',
      idempotency_model: 'unknown'
    };
  }
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function gitInventory(override) {
  if (override) {
    return override;
  }
  const commit = runGit(['rev-parse', '--short=12', 'HEAD']);
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const porcelain = runGit(['status', '--short']);
  return {
    available: Boolean(commit),
    branch: branch || null,
    commit: commit || null,
    worktree_clean: porcelain === '',
    dirty_entry_count: porcelain ? porcelain.split('\n').filter(Boolean).length : 0,
    status_summary: porcelain ? porcelain.split('\n').slice(0, 20) : []
  };
}

function buildBlockers({ config, env, smokes }) {
  return [
    config.nodeEnv !== 'production' ? 'NODE_ENV is not production; this runtime is not deploy-ready.' : null,
    env.some((item) => item.required && !item.present) ? 'one or more required runtime env vars are missing' : null,
    !config.internalAdminToken ? 'INTERNAL_ADMIN_TOKEN is missing' : null,
    !config.internalAdminSessionSecret ? 'INTERNAL_ADMIN_SESSION_SECRET is missing' : null,
    config.schedulerProviderMode !== 'mock' ? 'scheduler provider mode is not mock-safe' : null,
    config.schedulerAllowPaidProvider ? 'scheduler paid provider gate is open' : null,
    config.geoflowDryRun !== true ? 'GEFLOW_DRY_RUN is not true by default' : null,
    smokes.some((item) => !item.present) ? 'one or more required smoke scripts are missing' : null
  ].filter(Boolean);
}

function buildWarnings({ config }) {
  return [
    config.openrouterApiKey ? 'OPENROUTER_API_KEY is configured; R11 paid-provider approval still required before use.' : null,
    config.geoflowApiBaseUrl || config.geoflowApiToken
      ? 'GeoFlow live config is present; R8.3 approval phrase and live gate still required before dispatch.'
      : null,
    config.internalAdminToken === 'dev-ops-admin-token' ? 'INTERNAL_ADMIN_TOKEN is using default local value.' : null,
    config.internalAdminSessionSecret === 'dev-ops-session-secret-change-me'
      ? 'INTERNAL_ADMIN_SESSION_SECRET is using default local value.'
      : null
  ].filter(Boolean);
}

function buildRehearsalPlan({ assets, migrations }) {
  const missingAssets = assets.filter((asset) => asset.required && !asset.present).map((asset) => asset.path);
  return {
    schema_version: 'r9-2-backup-restore-migration-rehearsal-v1',
    mode: 'runbook_only_no_destructive_db',
    status: missingAssets.length || !migrations.present || migrations.total === 0 ? 'blocked' : 'ready_for_local_rehearsal',
    rehearsal_executed: false,
    production_data_mutated: false,
    assets,
    migrations,
    backup_plan: {
      command: 'DATABASE_URL=[redacted] scripts/backup-postgres.sh',
      expected_output: 'backups/avgl-YYYYMMDDTHHMMSSZ.dump',
      storage_policy: [
        'keep production backups outside git',
        'copy production backups off the VPS before deployment',
        'record backup filename, timestamp, byte size, and checksum in the release package'
      ],
      validation_checks: [
        'backup file exists',
        'backup file size is greater than zero',
        'backup filename timestamp is UTC',
        'backup checksum recorded outside the dump file'
      ]
    },
    restore_rehearsal_plan: {
      target_policy: 'restore only into a disposable rehearsal database; never restore over production during rehearsal',
      disposable_database: 'avgl_restore_rehearsal_YYYYMMDDHHMMSS',
      steps: [
        'create disposable restore database from an admin connection',
        'restore the dump into the disposable database with pg_restore --clean --if-exists --no-owner',
        'run read-only sanity checks against restored schema_migrations and core tables',
        'compare restored latest migration with source latest migration',
        'drop the disposable restore database after checks complete'
      ],
      forbidden_targets: ['production DATABASE_URL', 'primary local development database unless explicitly resetting local data'],
      recovery_checks: [
        'restore command exits zero',
        'schema_migrations table is readable',
        'latest migration version matches source code',
        'API is not pointed at the disposable database after rehearsal'
      ]
    },
    migration_rehearsal_plan: {
      command: 'npm run migrate',
      dry_run_available: false,
      idempotency_check: 'run migrations once, then run again and verify every migration is skipped as already applied',
      prechecks: [
        'backup completed and checksum recorded',
        'DATABASE_URL points to rehearsal/local database, not production',
        'schema_migrations table is readable',
        'migration files are sorted and immutable after release package is prepared'
      ],
      rollback_decision_points: [
        'stop before migration if backup is missing or restore rehearsal failed',
        'stop if migration fails before service restart',
        'rollback to restored backup if migrated service cannot pass /ready',
        'do not continue to deploy if migration state differs from release package'
      ]
    },
    seed_policy: {
      local: 'local smoke/seed data may be regenerated for test runs',
      production: 'do not run npm run seed against production unless a separate explicit production seed plan is approved',
      blocked_commands: ['npm run seed with production DATABASE_URL']
    },
    runbook_updates_required: [
      'add disposable restore database rehearsal flow',
      'add backup checksum recording',
      'add migration idempotency rehearsal result',
      'add rollback decision owner and timestamp',
      'add failed migration recovery checklist'
    ],
    blockers: [
      ...missingAssets.map((path) => `required rehearsal asset missing: ${path}`),
      !migrations.present ? 'migration directory is missing' : null,
      migrations.total === 0 ? 'no migration files found for rehearsal' : null
    ].filter(Boolean),
    guardrails: [
      'R9.2 produces rehearsal instructions and validation checks; it does not deploy.',
      'Restore rehearsal must use a disposable database target.',
      'Production backups, restores, and migrations require a separate same-turn approval.',
      'Destructive database commands remain blocked in this phase.'
    ]
  };
}

function buildReleaseRehearsalPackage({ readinessStatus, blockers, warnings, smokes, rehearsal, gates, git }) {
  const requiredSmokeNames = smokes.map((smoke) => smoke.name);
  const releaseBlockers = [
    ...blockers,
    ...rehearsal.blockers,
    !git.available ? 'git metadata is unavailable in this runtime' : null,
    git.available && !git.worktree_clean ? 'worktree has uncommitted or untracked changes' : null,
    rehearsal.status !== 'ready_for_local_rehearsal' ? 'backup/restore/migration rehearsal plan is not ready' : null,
    smokes.some((smoke) => !smoke.present) ? 'required smoke suite is incomplete' : null
  ].filter(Boolean);
  const goNoGo = releaseBlockers.length ? 'no_go' : warnings.length ? 'conditional_go_for_rehearsal_only' : 'go_for_rehearsal_only';

  return {
    schema_version: 'r9-3-release-rehearsal-package-v1',
    mode: 'no_deploy_go_no_go_checklist',
    generated_at: new Date().toISOString(),
    no_deploy_executed: true,
    deployment_executed: false,
    production_data_mutated: false,
    go_no_go_decision: goNoGo,
    decision_scope: 'release rehearsal only; production deployment still requires explicit same-turn approval',
    readiness_status: readinessStatus,
    git,
    required_env_summary: {
      source: 'deployment readiness env inventory',
      secret_values_redacted: true,
      production_secret_values_included: false
    },
    health_checks: [
      { name: '/ready', required: true, expected: 'service/database/redis ok' },
      { name: 'api container health', required: true, expected: 'running' },
      { name: 'worker process health', required: true, expected: 'running' },
      { name: 'scheduler process health', required: true, expected: 'running' }
    ],
    smoke_suite: requiredSmokeNames.map((name) => ({
      name,
      required: true,
      command: name === 'check' || name === 'test' ? `npm run ${name}` : `npm run ${name}`,
      present: smokes.some((smoke) => smoke.name === name && smoke.present)
    })),
    backup_status: {
      rehearsal_schema: rehearsal.schema_version,
      rehearsal_status: rehearsal.status,
      backup_command: rehearsal.backup_plan.command,
      backup_record_required: true,
      restore_rehearsal_required: true,
      rehearsal_executed: rehearsal.rehearsal_executed,
      production_data_mutated: rehearsal.production_data_mutated
    },
    migration_status: {
      latest_migration: rehearsal.migrations.latest,
      migration_count: rehearsal.migrations.total,
      command: rehearsal.migration_rehearsal_plan.command,
      idempotency_check: rehearsal.migration_rehearsal_plan.idempotency_check,
      rollback_decision_points: rehearsal.migration_rehearsal_plan.rollback_decision_points
    },
    rollback_procedure: [
      'stop release before deploy when go_no_go_decision is no_go',
      'keep current production services running until backup and restore rehearsal are verified',
      'if migration fails before service restart, restore from the recorded backup into the approved target',
      'if /ready fails after migration, keep deployment blocked and use the recorded rollback backup',
      'record rollback operator, timestamp, backup filename, and verification result'
    ],
    gates,
    blockers: releaseBlockers,
    warnings,
    checklist: [
      { item: 'commit/worktree state recorded', complete: git.available },
      { item: 'worktree clean or intentionally reviewed', complete: git.available && git.worktree_clean },
      { item: 'required env vars reviewed with secrets redacted', complete: true },
      { item: 'health checks listed', complete: true },
      { item: 'smoke suite listed', complete: !smokes.some((smoke) => !smoke.present) },
      { item: 'backup/restore rehearsal plan attached', complete: rehearsal.status === 'ready_for_local_rehearsal' },
      { item: 'migration rehearsal plan attached', complete: Boolean(rehearsal.migration_rehearsal_plan) },
      { item: 'rollback procedure attached', complete: true },
      { item: 'no deploy executed', complete: true }
    ]
  };
}

export function buildDeploymentReadiness(options = {}) {
  const config = options.config || getConfig();
  const scripts = options.scripts || readPackageScripts();
  const env = envInventory(config);
  const smokes = smokeInventory(scripts);
  const assets = options.assets || assetInventory();
  const migrations = options.migrations || migrationInventory();
  const rehearsal = buildRehearsalPlan({ assets, migrations });
  const blockers = buildBlockers({ config, env, smokes });
  const warnings = buildWarnings({ config });
  const status = blockers.length || rehearsal.blockers.length ? 'blocked' : warnings.length ? 'ready_with_warnings' : 'ready_for_release_rehearsal';
  const gates = {
    cloudflare_deploy_allowed: false,
    vps_deploy_allowed: false,
    remote_docker_compose_allowed: false,
    paid_provider_allowed: false,
    live_geoflow_dispatch_allowed: false,
    cms_publish_allowed: false,
    webhook_email_allowed: false,
    destructive_db_allowed: false
  };
  const git = gitInventory(options.git);
  const releasePackage = buildReleaseRehearsalPackage({
    readinessStatus: status,
    blockers,
    warnings,
    smokes,
    rehearsal,
    gates,
    git
  });

  return {
    schema_version: 'r9-3-deployment-readiness-release-package-v1',
    inventory_schema_version: 'r9-1-deployment-readiness-v1',
    rehearsal_schema_version: 'r9-2-deployment-readiness-rehearsal-v1',
    mode: 'backup_restore_migration_rehearsal_plan',
    status,
    deployment_executed: false,
    generated_at: new Date().toISOString(),
    runtime: {
      node_env: config.nodeEnv,
      port: config.port,
      scheduler_enabled: config.schedulerEnabled,
      scheduler_job_mode: config.schedulerJobMode,
      scheduler_provider_mode: config.schedulerProviderMode,
      scheduler_allow_paid_provider: config.schedulerAllowPaidProvider,
      geoflow_dry_run: config.geoflowDryRun
    },
    services: serviceInventory(config),
    env,
    smokes,
    gates,
    blockers,
    warnings,
    backup_restore_migration_rehearsal: rehearsal,
    release_rehearsal_package: releasePackage,
    runbook: {
      existing: 'docs/runbooks/deploy-later.md',
      next_required_sections: [
        'production env var checklist',
        'database backup command',
        'database restore rehearsal',
        'migration rehearsal',
        'rollback decision tree',
        'release smoke suite',
        'operator go/no-go checklist'
      ]
    },
    forbidden_commands: DEPLOYMENT_COMMANDS,
    guardrails: [
      'R9 readiness and rehearsal planning do not deploy Cloudflare, VPS, or remote Docker.',
      'Production data and production secrets must not be mutated during readiness checks.',
      'OpenRouter paid providers, live GeoFlow dispatch, CMS publish, webhook, and email remain blocked.',
      'R10 billing/auth bridge and R11 paid provider pilot are outside R9.'
    ]
  };
}
