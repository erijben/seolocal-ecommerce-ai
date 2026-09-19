<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KnowledgeDocument extends Model
{
    protected $fillable = [
        'title',
        'type',
        'content',
        'status',
        'created_by',
        'original_filename',
        'file_path',
        'mime_type',
        'file_size',
        'extraction_status',
        'extraction_error',
        'ai_document_id',
        'ai_index_status',
        'ai_index_error',
        'ai_indexed_at',
    ];

    protected $casts = [
        'ai_indexed_at' => 'datetime',
    ];

    public function chunks(): HasMany
    {
        return $this->hasMany(KnowledgeChunk::class);
    }
}