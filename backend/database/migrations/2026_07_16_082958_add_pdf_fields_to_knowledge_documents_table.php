<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge_documents', function (Blueprint $table) {
            $table->string('original_filename')->nullable()->after('content');
            $table->string('file_path')->nullable()->after('original_filename');
            $table->string('mime_type')->nullable()->after('file_path');
            $table->unsignedBigInteger('file_size')->nullable()->after('mime_type');
            $table->enum('extraction_status', ['pending', 'success', 'failed'])
                ->default('pending')
                ->after('file_size');
            $table->text('extraction_error')->nullable()->after('extraction_status');
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_documents', function (Blueprint $table) {
            $table->dropColumn([
                'original_filename',
                'file_path',
                'mime_type',
                'file_size',
                'extraction_status',
                'extraction_error',
            ]);
        });
    }
};