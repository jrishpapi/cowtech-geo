<?php

namespace App\Services\Admin;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Builds a non-destructive update plan for operators.
 *
 * The web app deliberately does not execute host shell commands. This service
 * turns release metadata into preflight checks, backup targets, and manual
 * commands that an operator can run over SSH after review.
 */
class AdminUpdateSafetyGateService
{
    public function __construct(
        private readonly AdminUpdateMetadataService $metadataService
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function buildPlan(): array
    {
        $state = $this->metadataService->fetchState();
        $payload = is_array($state['payload'] ?? null) ? $state['payload'] : [];
        $latestVersion = trim((string) ($state['latest_version'] ?? ''));
        $currentVersion = trim((string) ($state['current_version'] ?? ''));
        $archiveUrl = trim((string) ($state['archive_url'] ?? $payload['archive_url'] ?? ''));
        $releaseUrl = trim((string) ($payload['release_url'] ?? ''));
        $changelogUrl = trim((string) ($payload['changelog_url_zh'] ?? $payload['changelog_url_en'] ?? ''));

        $checks = $this->preflightChecks($state, $archiveUrl);
        $canPlan = collect($checks)->every(static fn (array $check): bool => ($check['status'] ?? '') !== 'fail');

        return [
            'schema' => 'geoflow-update-safety-gate-v1',
            'status' => $this->planStatus($state, $canPlan),
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
            'is_update_available' => (bool) ($state['is_update_available'] ?? false),
            'source_url' => (string) ($state['source_url'] ?? ''),
            'archive_url' => $archiveUrl,
            'release_url' => $releaseUrl,
            'changelog_url' => $changelogUrl,
            'checked_at' => (string) ($state['checked_at'] ?? ''),
            'summary' => [
                'zh' => (string) ($payload['summary_zh'] ?? ''),
                'en' => (string) ($payload['summary_en'] ?? ''),
                'upgrade_tip_zh' => (string) ($payload['upgrade_tip_zh'] ?? ''),
                'upgrade_tip_en' => (string) ($payload['upgrade_tip_en'] ?? ''),
            ],
            'preflight_checks' => $checks,
            'backup_targets' => $this->backupTargets(),
            'manual_commands' => $this->manualCommands($latestVersion, $archiveUrl),
            'rollback_commands' => $this->rollbackCommands($latestVersion),
            'operator_notes' => $this->operatorNotes(),
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @return list<array{key:string,label:string,status:string,detail:string}>
     */
    private function preflightChecks(array $state, string $archiveUrl): array
    {
        $storageWritable = File::isWritable(storage_path());
        $envExists = File::exists(base_path('.env'));
        $gitExists = File::isDirectory(base_path('.git'));
        $freeBytes = @disk_free_space(base_path());
        $databaseOk = $this->databaseConnectionOk();

        return [
            [
                'key' => 'metadata',
                'label' => 'Remote release metadata',
                'status' => ($state['status'] ?? '') === 'error' ? 'fail' : 'pass',
                'detail' => ($state['status'] ?? '') === 'error'
                    ? 'Remote version metadata is unavailable.'
                    : 'Remote version metadata loaded.',
            ],
            [
                'key' => 'archive',
                'label' => 'Release archive URL',
                'status' => $archiveUrl !== '' ? 'pass' : 'warn',
                'detail' => $archiveUrl !== ''
                    ? 'Release archive URL is present.'
                    : 'No archive URL was provided; use Git upstream fetch/merge instead.',
            ],
            [
                'key' => 'git',
                'label' => 'Git working copy',
                'status' => $gitExists ? 'pass' : 'warn',
                'detail' => $gitExists
                    ? 'Application root is a Git working copy.'
                    : 'No .git directory was found in the application root.',
            ],
            [
                'key' => 'env',
                'label' => '.env file',
                'status' => $envExists ? 'pass' : 'fail',
                'detail' => $envExists
                    ? '.env exists and must be backed up before updating.'
                    : '.env is missing; do not update until runtime configuration is restored.',
            ],
            [
                'key' => 'storage',
                'label' => 'Storage writability',
                'status' => $storageWritable ? 'pass' : 'fail',
                'detail' => $storageWritable
                    ? 'storage/ is writable.'
                    : 'storage/ is not writable; backups and cache rebuild may fail.',
            ],
            [
                'key' => 'disk',
                'label' => 'Disk free space',
                'status' => $freeBytes === false || $freeBytes > 1024 * 1024 * 1024 ? 'pass' : 'warn',
                'detail' => $freeBytes === false
                    ? 'Disk free space could not be read.'
                    : 'Free space: '.number_format((float) $freeBytes / 1024 / 1024 / 1024, 2).' GB.',
            ],
            [
                'key' => 'database',
                'label' => 'Database connectivity',
                'status' => $databaseOk ? 'pass' : 'fail',
                'detail' => $databaseOk
                    ? 'Database connection is available.'
                    : 'Database connection failed; do not run migrations.',
            ],
        ];
    }

    private function databaseConnectionOk(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return list<array{path:string,reason:string}>
     */
    private function backupTargets(): array
    {
        return [
            ['path' => '.env', 'reason' => 'Runtime secrets and environment configuration.'],
            ['path' => '.env.prod', 'reason' => 'Production compose environment mirror when present.'],
            ['path' => 'storage/', 'reason' => 'Uploads, logs, cached update manifests, and app files.'],
            ['path' => 'public/assets/', 'reason' => 'Published image assets served by the site.'],
            ['path' => 'database dump', 'reason' => 'Required before php artisan migrate.'],
            ['path' => 'docker-compose.prod.yml', 'reason' => 'Production container topology and port mapping.'],
        ];
    }

    /**
     * @return list<string>
     */
    private function manualCommands(string $latestVersion, string $archiveUrl): array
    {
        $tag = $this->safeVersionTag($latestVersion);
        $commands = [
            'cd /opt/geoflow-laravel',
            'git status --short',
            'git tag before-cowtech-'.$tag.' || true',
            'mkdir -p /opt/geoflow-backups/'.$tag,
            'cp -a .env .env.prod storage public/assets docker-compose.prod.yml /opt/geoflow-backups/'.$tag.'/',
            'docker exec geoflow-postgres-prod pg_dump -U ${POSTGRES_USER:-geoflow} ${POSTGRES_DB:-geoflow} > /opt/geoflow-backups/'.$tag.'/postgres.sql',
            'git remote get-url cowtech # Configure your own verified release remote before continuing',
            'git fetch cowtech',
            'git checkout -B update/cowtech-'.$tag,
            'git merge --no-ff cowtech/master',
            'docker compose -f docker-compose.prod.yml run --rm app composer install --no-dev --optimize-autoloader',
            'docker compose -f docker-compose.prod.yml run --rm app php artisan migrate --pretend',
            'docker compose -f docker-compose.prod.yml run --rm app php artisan test',
            'docker compose -f docker-compose.prod.yml build app web queue scheduler',
            'docker compose -f docker-compose.prod.yml up -d',
            'docker compose -f docker-compose.prod.yml exec app php artisan migrate --force',
            'docker compose -f docker-compose.prod.yml exec app php artisan optimize',
            'docker compose -f docker-compose.prod.yml ps',
        ];

        if ($archiveUrl !== '') {
            array_splice($commands, 8, 0, ['# Release archive available: '.$archiveUrl]);
        }

        return $commands;
    }

    /**
     * @return list<string>
     */
    private function rollbackCommands(string $latestVersion): array
    {
        $tag = $this->safeVersionTag($latestVersion);

        return [
            'cd /opt/geoflow-laravel',
            'git checkout before-cowtech-'.$tag,
            'cp -a /opt/geoflow-backups/'.$tag.'/.env /opt/geoflow-backups/'.$tag.'/.env.prod .',
            'cp -a /opt/geoflow-backups/'.$tag.'/storage /opt/geoflow-backups/'.$tag.'/assets public/',
            'docker compose -f docker-compose.prod.yml up -d --build',
            '# Restore database manually from /opt/geoflow-backups/'.$tag.'/postgres.sql if migrations changed data.',
        ];
    }

    /**
     * @return list<string>
     */
    private function operatorNotes(): array
    {
        return [
            'The web UI is a safety gate and does not execute shell commands.',
            'Always test the update branch before replacing production containers.',
            'Do not run migrations until a database dump and file backup exist.',
            'Keep the before-cowtech-* tag until the updated system has run safely for several days.',
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function planStatus(array $state, bool $canPlan): string
    {
        if (! (bool) ($state['is_update_available'] ?? false)) {
            return 'current';
        }

        return $canPlan ? 'ready_for_operator_review' : 'blocked';
    }

    private function safeVersionTag(string $version): string
    {
        $tag = preg_replace('/[^A-Za-z0-9._-]+/', '-', $version) ?: 'unknown';

        return trim($tag, '-_.') !== '' ? trim($tag, '-_.') : 'unknown';
    }
}
