<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_billing_entitlements')) {
            return;
        }

        Schema::create('customer_billing_entitlements', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 160)->unique();
            $table->string('plan_code', 40)->index();
            $table->string('billing_status', 40)->default('active')->index();
            $table->string('payment_provider', 40)->default('paypal');
            $table->string('provider_order_id', 120)->nullable()->index();
            $table->string('provider_subscription_id', 160)->nullable()->index();
            $table->string('provider_transaction_id', 160)->nullable()->index();
            $table->decimal('amount', 10, 2)->nullable();
            $table->string('currency', 12)->default('usd');
            $table->text('source_payload_json')->nullable();
            $table->timestamp('synced_to_aivgl_at')->nullable();
            $table->text('last_sync_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_billing_entitlements');
    }
};
