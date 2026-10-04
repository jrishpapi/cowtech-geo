<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tasks')) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('tasks', 'aivgl_run_id')) {
                $table->string('aivgl_run_id', 120)->nullable()->after('geo_brief_json')->index();
            }
            if (! Schema::hasColumn('tasks', 'aivgl_discovery_run_id')) {
                $table->string('aivgl_discovery_run_id', 120)->nullable()->after('aivgl_run_id');
            }
            if (! Schema::hasColumn('tasks', 'aivgl_opportunity_id')) {
                $table->string('aivgl_opportunity_id', 120)->nullable()->after('aivgl_discovery_run_id')->index();
            }
            if (! Schema::hasColumn('tasks', 'aivgl_opportunity_key')) {
                $table->string('aivgl_opportunity_key', 180)->nullable()->after('aivgl_opportunity_id');
            }
            if (! Schema::hasColumn('tasks', 'aivgl_brief_id')) {
                $table->string('aivgl_brief_id', 120)->nullable()->after('aivgl_opportunity_key')->index();
            }
            if (! Schema::hasColumn('tasks', 'aivgl_brief_key')) {
                $table->string('aivgl_brief_key', 220)->nullable()->after('aivgl_brief_id');
            }
            if (! Schema::hasColumn('tasks', 'aivgl_handoff_payload_json')) {
                $table->text('aivgl_handoff_payload_json')->nullable()->after('aivgl_brief_key');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tasks')) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table): void {
            foreach ([
                'aivgl_handoff_payload_json',
                'aivgl_brief_key',
                'aivgl_brief_id',
                'aivgl_opportunity_key',
                'aivgl_opportunity_id',
                'aivgl_discovery_run_id',
                'aivgl_run_id',
            ] as $column) {
                if (Schema::hasColumn('tasks', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
