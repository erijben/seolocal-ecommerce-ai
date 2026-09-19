<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'knowledge_documents',
            function (Blueprint $table) {
                $table->uuid('ai_document_id')
                    ->nullable()
                    ->unique()
                    ->after('id');

                $table->string('ai_index_status', 20)
                    ->nullable()
                    ->index()
                    ->after('extraction_error');

                $table->text('ai_index_error')
                    ->nullable()
                    ->after('ai_index_status');

                $table->timestamp('ai_indexed_at')
                    ->nullable()
                    ->after('ai_index_error');
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'knowledge_documents',
            function (Blueprint $table) {
                $table->dropUnique(['ai_document_id']);
                $table->dropIndex(['ai_index_status']);

                $table->dropColumn([
                    'ai_document_id',
                    'ai_index_status',
                    'ai_index_error',
                    'ai_indexed_at',
                ]);
            }
        );
    }
};