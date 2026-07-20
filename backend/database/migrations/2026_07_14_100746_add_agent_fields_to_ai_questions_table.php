<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_questions', function (Blueprint $table) {
            $table->string('intent')->nullable()->after('question');
            $table->string('provider')->default('demo')->after('intent');
            $table->json('used_data')->nullable()->after('provider');
        });
    }

    public function down(): void
    {
        Schema::table('ai_questions', function (Blueprint $table) {
            $table->dropColumn(['intent', 'provider', 'used_data']);
        });
    }
};