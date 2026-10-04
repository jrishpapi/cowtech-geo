<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

declare(strict_types=1);

/**
 * 供「版本更新」模式弹窗使用。
 */
return static function (array $welcomeState): array {
    $updateState = $welcomeState['update'] ?? [];
    $defaultVersion = (string) config('geoflow.welcome_intro_version', '2.0');
    $currentVersion = (string) ($updateState['current_version'] ?? $defaultVersion);
    $latestVersion = (string) ($updateState['latest_version'] ?? '');
    $payload = is_array($updateState['payload'] ?? null) ? $updateState['payload'] : [];
    $releaseDate = trim((string) ($payload['release_date'] ?? ''));
    $releaseType = trim((string) ($payload['release_type'] ?? 'feature'));

    $releaseTypeMapZh = [
        'feature' => '功能更新',
        'fix' => '问题修复',
        'security' => '安全更新',
    ];
    $releaseTypeMapEn = [
        'feature' => 'Feature update',
        'fix' => 'Bug fix',
        'security' => 'Security update',
    ];

    return [
        'zh-CN' => [
            'meta' => [
                'badge' => '版本更新',
                'switch_label' => 'English',
                'close' => '关闭',
            ],
            'letter' => [
                'title' => 'CowTech GEO 有新版本可更新',
                'subtitle' => '当前版本 v'.$currentVersion.'，最新版本 v'.$latestVersion.'。',
                'blocks' => [
                    [
                        'type' => 'paragraph',
                        'content' => '后台已经检测到 CowTech GEO 有一个新版本可用。',
                    ],
                    [
                        'type' => 'paragraph',
                        'content' => '这次更新已经整理成商业版本元数据。你可以先确认当前业务状态，再决定什么时候升级。',
                    ],
                    [
                        'type' => 'list',
                        'items' => [
                            '当前版本：v'.$currentVersion,
                            '最新版本：v'.$latestVersion,
                            '发布类型：'.($releaseTypeMapZh[$releaseType] ?? $releaseTypeMapZh['feature']),
                            '发布日期：'.($releaseDate !== '' ? $releaseDate : '暂未标注'),
                        ],
                    ],
                    [
                        'type' => 'paragraph',
                        'content' => '如果你准备升级，建议先备份数据库与 uploads 目录，再按商业部署流程执行更新。',
                    ],
                ],
            ],
        ],
        'en' => [
            'meta' => [
                'badge' => 'Release Update',
                'switch_label' => '中文',
                'close' => 'Close',
            ],
            'letter' => [
                'title' => 'A new CowTech GEO version is available',
                'subtitle' => 'Current version v'.$currentVersion.', latest version v'.$latestVersion.'.',
                'blocks' => [
                    [
                        'type' => 'paragraph',
                        'content' => 'The admin has detected that a newer CowTech GEO release is available.',
                    ],
                    [
                        'type' => 'paragraph',
                        'content' => 'This update is available through commercial release metadata, so you can review the business state before deciding when to upgrade.',
                    ],
                    [
                        'type' => 'list',
                        'items' => [
                            'Current version: v'.$currentVersion,
                            'Latest version: v'.$latestVersion,
                            'Release type: '.($releaseTypeMapEn[$releaseType] ?? $releaseTypeMapEn['feature']),
                            'Release date: '.($releaseDate !== '' ? $releaseDate : 'Not specified'),
                        ],
                    ],
                    [
                        'type' => 'paragraph',
                        'content' => 'Before upgrading, back up the database and uploads directory, then follow the commercial deployment flow.',
                    ],
                ],
            ],
        ],
    ];
};
