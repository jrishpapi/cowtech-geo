<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_workspaces')) {
            return;
        }

        Schema::create('customer_workspaces', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('admin_id')->nullable()->index();
            $table->string('brand_name', 160);
            $table->string('brand_url', 500);
            $table->string('business_summary', 500)->nullable();
            $table->text('competitors_text')->nullable();
            $table->text('target_prompts_text')->nullable();
            $table->string('target_market', 160)->nullable();
            $table->string('locale', 20)->default('en');
            $table->string('status', 40)->default('diagnosis_pending')->index();
            $table->string('aivgl_customer_id', 120)->nullable();
            $table->string('aivgl_brand_id', 120)->nullable()->index();
            $table->string('aivgl_prompt_set_id', 120)->nullable();
            $table->string('aivgl_tracking_run_id', 120)->nullable()->index();
            $table->string('aivgl_discovery_run_id', 120)->nullable();
            $table->string('aivgl_provider_mode', 40)->nullable();
            $table->timestamp('diagnosis_started_at')->nullable();
            $table->timestamp('diagnosis_completed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->text('payload_json')->nullable();
            $table->timestamps();

            $table->unique('admin_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_workspaces');
    }
};
