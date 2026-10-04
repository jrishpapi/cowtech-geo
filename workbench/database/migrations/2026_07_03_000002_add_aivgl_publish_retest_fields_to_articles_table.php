<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('articles')) {
            return;
        }

        Schema::table('articles', function (Blueprint $table): void {
            if (! Schema::hasColumn('articles', 'aivgl_publish_handoff_id')) {
                $table->string('aivgl_publish_handoff_id', 120)->nullable()->after('generation_meta_json')->index();
            }
            if (! Schema::hasColumn('articles', 'aivgl_publish_synced_at')) {
                $table->timestamp('aivgl_publish_synced_at')->nullable()->after('aivgl_publish_handoff_id');
            }
            if (! Schema::hasColumn('articles', 'aivgl_retest_schedule_id')) {
                $table->string('aivgl_retest_schedule_id', 120)->nullable()->after('aivgl_publish_synced_at')->index();
            }
            if (! Schema::hasColumn('articles', 'aivgl_retest_scheduled_at')) {
                $table->timestamp('aivgl_retest_scheduled_at')->nullable()->after('aivgl_retest_schedule_id');
            }
            if (! Schema::hasColumn('articles', 'aivgl_retest_status')) {
                $table->string('aivgl_retest_status', 60)->nullable()->after('aivgl_retest_scheduled_at')->index();
            }
            if (! Schema::hasColumn('articles', 'aivgl_retest_last_error')) {
                $table->text('aivgl_retest_last_error')->nullable()->after('aivgl_retest_status');
            }
            if (! Schema::hasColumn('articles', 'aivgl_publish_retest_payload_json')) {
                $table->text('aivgl_publish_retest_payload_json')->nullable()->after('aivgl_retest_last_error');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('articles')) {
            return;
        }

        Schema::table('articles', function (Blueprint $table): void {
            foreach ([
                'aivgl_publish_retest_payload_json',
                'aivgl_retest_last_error',
                'aivgl_retest_status',
                'aivgl_retest_scheduled_at',
                'aivgl_retest_schedule_id',
                'aivgl_publish_synced_at',
                'aivgl_publish_handoff_id',
            ] as $column) {
                if (Schema::hasColumn('articles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
