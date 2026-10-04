<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_billing_addons')) {
            return;
        }

        Schema::create('customer_billing_addons', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 160)->index();
            $table->string('addon_code', 60)->index();
            $table->string('unit_type', 40)->index();
            $table->unsignedInteger('units')->default(1);
            $table->string('billing_status', 40)->default('active')->index();
            $table->string('billing_period', 40)->default('one_time');
            $table->string('payment_provider', 40)->default('paypal');
            $table->string('provider_order_id', 120)->nullable()->index();
            $table->string('provider_subscription_id', 160)->nullable()->index();
            $table->string('provider_transaction_id', 160)->nullable()->unique();
            $table->decimal('amount', 10, 2)->nullable();
            $table->string('currency', 12)->default('usd');
            $table->text('source_payload_json')->nullable();
            $table->timestamp('synced_to_aivgl_at')->nullable();
            $table->text('last_sync_error')->nullable();
            $table->timestamps();

            $table->unique(['email', 'provider_order_id', 'addon_code'], 'customer_addons_email_order_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_billing_addons');
    }
};
