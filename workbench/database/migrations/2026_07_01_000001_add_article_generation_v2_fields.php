<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table): void {
                if (! Schema::hasColumn('tasks', 'content_generation_mode')) {
                    $table->string('content_generation_mode', 40)->default('legacy')->after('model_selection_mode');
                }
                if (! Schema::hasColumn('tasks', 'geo_brief_json')) {
                    $table->text('geo_brief_json')->nullable()->after('content_generation_mode');
                }
                if (! Schema::hasColumn('tasks', 'quality_gate_enabled')) {
                    $table->integer('quality_gate_enabled')->default(1)->after('geo_brief_json');
                }
            });
        }

        if (Schema::hasTable('articles')) {
            Schema::table('articles', function (Blueprint $table): void {
                if (! Schema::hasColumn('articles', 'generation_meta_json')) {
                    $table->text('generation_meta_json')->nullable()->after('meta_description');
                }
                if (! Schema::hasColumn('articles', 'quality_score')) {
                    $table->integer('quality_score')->default(0)->after('generation_meta_json');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('articles')) {
            Schema::table('articles', function (Blueprint $table): void {
                foreach (['quality_score', 'generation_meta_json'] as $column) {
                    if (Schema::hasColumn('articles', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table): void {
                foreach (['quality_gate_enabled', 'geo_brief_json', 'content_generation_mode'] as $column) {
                    if (Schema::hasColumn('tasks', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
