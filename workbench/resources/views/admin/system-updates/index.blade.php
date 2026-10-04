{{-- Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE. --}}
@extends('admin.layouts.app')

@php
    $checks = is_array($plan['preflight_checks'] ?? null) ? $plan['preflight_checks'] : [];
    $backupTargets = is_array($plan['backup_targets'] ?? null) ? $plan['backup_targets'] : [];
    $commands = is_array($plan['manual_commands'] ?? null) ? $plan['manual_commands'] : [];
    $rollbackCommands = is_array($plan['rollback_commands'] ?? null) ? $plan['rollback_commands'] : [];
    $notes = is_array($plan['operator_notes'] ?? null) ? $plan['operator_notes'] : [];
    $summary = is_array($plan['summary'] ?? null) ? $plan['summary'] : [];
    $status = (string) ($plan['status'] ?? 'current');
    $statusClasses = [
        'ready_for_operator_review' => 'bg-amber-50 text-amber-700 border-amber-200',
        'blocked' => 'bg-red-50 text-red-700 border-red-200',
        'current' => 'bg-green-50 text-green-700 border-green-200',
    ];
@endphp

@section('content')
    <div class="px-4 sm:px-0 space-y-6" data-update-safety-gate>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">{{ __('admin.system_updates.page_heading') }}</h1>
                <p class="mt-1 text-sm text-gray-600">{{ __('admin.system_updates.page_subtitle') }}</p>
            </div>
            <span class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium {{ $statusClasses[$status] ?? 'bg-gray-50 text-gray-700 border-gray-200' }}">
                {{ __('admin.system_updates.status.'.$status) }}
            </span>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">{{ __('admin.system_updates.current_version') }}</div>
                <div class="mt-2 text-xl font-semibold text-gray-900">v{{ $plan['current_version'] ?? '' }}</div>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">{{ __('admin.system_updates.latest_version') }}</div>
                <div class="mt-2 text-xl font-semibold text-gray-900">v{{ $plan['latest_version'] ?: '-' }}</div>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">{{ __('admin.system_updates.checked_at') }}</div>
                <div class="mt-2 text-sm font-medium text-gray-900">{{ $plan['checked_at'] ?: '-' }}</div>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div class="text-sm text-gray-500">{{ __('admin.system_updates.archive') }}</div>
                <div class="mt-2 truncate text-sm font-medium text-gray-900">{{ $plan['archive_url'] ?: '-' }}</div>
            </div>
        </div>

        @if(($summary['zh'] ?? '') !== '')
            <div class="rounded-lg border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
                <div class="font-semibold">{{ __('admin.system_updates.release_summary') }}</div>
                <p class="mt-2">{{ $summary['zh'] }}</p>
                @if(($summary['upgrade_tip_zh'] ?? '') !== '')
                    <p class="mt-2">{{ $summary['upgrade_tip_zh'] }}</p>
                @endif
            </div>
        @endif

        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-200 px-6 py-4">
                <h2 class="text-lg font-semibold text-gray-900">{{ __('admin.system_updates.preflight_title') }}</h2>
            </div>
            <div class="divide-y divide-gray-100">
                @foreach($checks as $check)
                    @php($checkStatus = (string) ($check['status'] ?? 'warn'))
                    <div class="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div class="font-medium text-gray-900">{{ $check['label'] ?? '' }}</div>
                            <div class="mt-1 text-sm text-gray-500">{{ $check['detail'] ?? '' }}</div>
                        </div>
                        <span @class([
                            'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            'bg-green-100 text-green-700' => $checkStatus === 'pass',
                            'bg-amber-100 text-amber-700' => $checkStatus === 'warn',
                            'bg-red-100 text-red-700' => $checkStatus === 'fail',
                        ])>{{ __('admin.system_updates.check_status.'.$checkStatus) }}</span>
                    </div>
                @endforeach
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div class="border-b border-gray-200 px-6 py-4">
                    <h2 class="text-lg font-semibold text-gray-900">{{ __('admin.system_updates.backup_title') }}</h2>
                </div>
                <div class="divide-y divide-gray-100">
                    @foreach($backupTargets as $target)
                        <div class="px-6 py-4">
                            <div class="font-mono text-sm font-semibold text-gray-900">{{ $target['path'] ?? '' }}</div>
                            <div class="mt-1 text-sm text-gray-500">{{ $target['reason'] ?? '' }}</div>
                        </div>
                    @endforeach
                </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div class="border-b border-gray-200 px-6 py-4">
                    <h2 class="text-lg font-semibold text-gray-900">{{ __('admin.system_updates.notes_title') }}</h2>
                </div>
                <ul class="space-y-3 px-6 py-4 text-sm text-gray-600">
                    @foreach($notes as $note)
                        <li class="flex gap-2">
                            <i data-lucide="shield-check" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600"></i>
                            <span>{{ $note }}</span>
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-200 px-6 py-4">
                <h2 class="text-lg font-semibold text-gray-900">{{ __('admin.system_updates.commands_title') }}</h2>
            </div>
            <pre class="overflow-x-auto whitespace-pre-wrap px-6 py-4 text-sm leading-6 text-gray-800"><code>{{ implode("\n", $commands) }}</code></pre>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-200 px-6 py-4">
                <h2 class="text-lg font-semibold text-gray-900">{{ __('admin.system_updates.rollback_title') }}</h2>
            </div>
            <pre class="overflow-x-auto whitespace-pre-wrap px-6 py-4 text-sm leading-6 text-gray-800"><code>{{ implode("\n", $rollbackCommands) }}</code></pre>
        </div>
    </div>
@endsection
