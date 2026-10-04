<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerWorkspace extends Model
{
    protected $fillable = [
        'admin_id',
        'brand_name',
        'brand_url',
        'business_summary',
        'competitors_text',
        'target_prompts_text',
        'target_market',
        'locale',
        'status',
        'aivgl_customer_id',
        'aivgl_brand_id',
        'aivgl_prompt_set_id',
        'aivgl_tracking_run_id',
        'aivgl_discovery_run_id',
        'aivgl_provider_mode',
        'diagnosis_started_at',
        'diagnosis_completed_at',
        'last_error',
        'payload_json',
    ];

    protected function casts(): array
    {
        return [
            'admin_id' => 'integer',
            'diagnosis_started_at' => 'datetime',
            'diagnosis_completed_at' => 'datetime',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function hasDiagnosisRun(): bool
    {
        return trim((string) $this->aivgl_tracking_run_id) !== '';
    }

    public function launchPackFulfillments(): HasMany
    {
        return $this->hasMany(CustomerLaunchPackFulfillment::class, 'workspace_id');
    }
}
