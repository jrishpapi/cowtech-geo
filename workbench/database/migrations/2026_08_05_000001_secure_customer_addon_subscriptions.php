<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_billing_addons')) {
            return;
        }

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS customer_addons_email_subscription_code_unique ON customer_billing_addons (email, provider_subscription_id, addon_code) WHERE provider_subscription_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS customer_addons_email_subscription_code_unique');
    }
};
