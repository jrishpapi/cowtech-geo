<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerBillingEntitlement extends Model
{
    protected $fillable = [
        'admin_id',
        'claimed_at',
        'email',
        'plan_code',
        'billing_status',
        'payment_provider',
        'provider_order_id',
        'provider_subscription_id',
        'provider_transaction_id',
        'amount',
        'currency',
        'source_payload_json',
        'synced_to_aivgl_at',
        'last_sync_error',
    ];

    protected function casts(): array
    {
        return [
            'admin_id' => 'integer',
            'claimed_at' => 'datetime',
            'amount' => 'decimal:2',
            'synced_to_aivgl_at' => 'datetime',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function emailClaims(): HasMany
    {
        return $this->hasMany(CustomerEmailClaim::class, 'entitlement_id');
    }
}
