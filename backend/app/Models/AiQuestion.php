<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiQuestion extends Model
{
   protected $fillable = [
        'user_id',
        'question',
        'intent',
        'provider',
        'used_data',
        'answer',
    ];
 protected $casts = [
        'used_data' => 'array',
    ];
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}