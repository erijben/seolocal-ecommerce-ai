<?php
//stocker le document complet
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
];

    public function chunks(): HasMany
    {
        return $this->hasMany(KnowledgeChunk::class);
    }
}