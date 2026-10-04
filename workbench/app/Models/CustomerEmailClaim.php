<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerEmailClaim extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'admin_id',
        'entitlement_id',
        'provider_order_id',
        'code_hash',
        'expires_at',
        'attempts',
        'last_sent_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'admin_id' => 'integer',
            'entitlement_id' => 'integer',
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'last_sent_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function entitlement(): BelongsTo
    {
        return $this->belongsTo(CustomerBillingEntitlement::class, 'entitlement_id');
    }
}
