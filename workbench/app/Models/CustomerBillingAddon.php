<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerBillingAddon extends Model
{
    protected $fillable = [
        'email',
        'addon_code',
        'unit_type',
        'units',
        'billing_status',
        'billing_period',
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
            'units' => 'integer',
            'amount' => 'decimal:2',
            'synced_to_aivgl_at' => 'datetime',
        ];
    }
}
