<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_launch_pack_fulfillments')) {
            return;
        }

        Schema::create('customer_launch_pack_fulfillments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('workspace_id')->index();
            $table->unsignedBigInteger('entitlement_id')->index();
            $table->string('order_id', 120)->unique();
            $table->string('email', 160)->index();
            $table->string('baseline_run_id', 120)->nullable()->index();
            $table->string('state', 40)->default('baseline_running')->index();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->timestamp('next_attempt_at')->nullable()->index();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('last_error_code', 120)->nullable();
            $table->text('last_error_message')->nullable();
            $table->json('baseline_snapshot_json')->nullable();
            $table->timestamps();

            $table->unique(['workspace_id', 'entitlement_id'], 'customer_launch_pack_workspace_entitlement_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_launch_pack_fulfillments');
    }
};
