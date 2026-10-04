<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

/**
 * Artisan 自定义命令注册（闭包命令或后续类命令）。
 */

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Horizon 监控快照：用于沉淀队列吞吐、等待等时序指标。
 */
Schedule::command('horizon:snapshot')->everyFiveMinutes();

/**
 * GeoFlow 任务调度：每分钟扫描一次可执行任务并入队（对齐 bak cron 逻辑）。
 */
Schedule::command('geoflow:schedule-tasks')->everyMinute();

/**
 * Complete due post-publish retests without waiting for a monthly road test.
 * Provider mode and paid access remain server-side configuration and are still
 * enforced again by AIVGL customer entitlement and cost gates.
 */
Artisan::command('aivgl:run-due-retests {--due-at=} {--limit=3}', function () {
    $result = app(\App\Services\Customer\AivglRetestScheduler::class)->run(
        is_string($this->option('due-at')) ? $this->option('due-at') : null,
        (int) $this->option('limit')
    );
    $this->line(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
})->purpose('Run due AIVGL post-publish retests through the configured customer provider');

Schedule::command('aivgl:run-due-retests')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);

Artisan::command('launch-pack:reconcile {--limit=20}', function () {
    $result = app(\App\Services\Customer\LaunchPackOrchestrator::class)
        ->reconcile((int) $this->option('limit'));
    $this->line(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
})->purpose('Recover and advance baseline-driven Launch Pack fulfillment');

Schedule::command('launch-pack:reconcile --limit=20')
    ->everyMinute()
    ->withoutOverlapping(5);
