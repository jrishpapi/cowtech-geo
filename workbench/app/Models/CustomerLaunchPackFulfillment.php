<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerLaunchPackFulfillment extends Model
{
    protected $fillable = [
        'workspace_id',
        'entitlement_id',
        'order_id',
        'email',
        'baseline_run_id',
        'state',
        'attempt_count',
        'next_attempt_at',
        'last_attempt_at',
        'completed_at',
        'last_error_code',
        'last_error_message',
        'baseline_snapshot_json',
    ];

    protected function casts(): array
    {
        return [
            'attempt_count' => 'integer',
            'next_attempt_at' => 'datetime',
            'last_attempt_at' => 'datetime',
            'completed_at' => 'datetime',
            'baseline_snapshot_json' => 'array',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(CustomerWorkspace::class, 'workspace_id');
    }

    public function entitlement(): BelongsTo
    {
        return $this->belongsTo(CustomerBillingEntitlement::class, 'entitlement_id');
    }

    public function customerStatus(): array
    {
        return match ((string) $this->state) {
            'baseline_running' => ['baseline_running', 'AIVGL baseline 正在生成', 'wait_for_baseline'],
            'baseline_ready', 'queued' => ['queued', 'Launch Pack 已进入生成队列', 'wait_for_generation'],
            'generating' => ['generating', 'Launch Pack 正在生成', 'wait_for_generation'],
            'quality_check' => ['quality_check', 'Launch Pack 正在进行质量检查', 'wait_for_quality_check'],
            'ready' => ['ready', 'Delivery ready', 'download_files'],
            'retry_scheduled' => ['retry_scheduled', '生成暂时中断，系统将自动重试', 'wait_for_retry'],
            'review_required' => ['review_required', '内容证据不足，正在等待质量复核', 'contact_support'],
            'failed' => ['failed', 'Launch Pack 生成失败', 'contact_support'],
            default => ['pending', '履约状态同步中', 'wait_for_generation'],
        };
    }
}
