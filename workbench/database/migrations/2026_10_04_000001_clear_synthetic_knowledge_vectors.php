<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('knowledge_chunks')) {
            return;
        }

        // Keep all source text and genuine model embeddings. Old hash vectors
        // are derived data and must not be consumed as semantic embeddings.
        $values = [
            'embedding_json' => '[]',
            'embedding_dimensions' => 0,
            'embedding_provider' => '',
        ];
        if (Schema::hasColumn('knowledge_chunks', 'embedding_vector')) {
            $values['embedding_vector'] = null;
        }
        DB::table('knowledge_chunks')->where(function ($query): void {
            $query->whereNull('embedding_model_id')
                ->orWhere('embedding_dimensions', '<=', 0);
        })->update($values);
    }

    public function down(): void
    {
        // Do not recreate synthetic vectors on rollback. Source text is intact.
    }
};
