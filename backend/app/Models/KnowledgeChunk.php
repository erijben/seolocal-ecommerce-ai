<?php
//stocker les petits morceaux du document
namespace App\Models;
/*Pourquoi on découpe ?
Parce que dans un vrai RAG, on ne donne pas tout le document à l’IA. On récupère seulement les passages pertinents.*/
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KnowledgeChunk extends Model
{
    protected $fillable = [
        'knowledge_document_id',
        'chunk_index',
        'content',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }
}