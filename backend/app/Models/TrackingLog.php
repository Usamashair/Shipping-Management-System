<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrackingLog extends Model
{
    protected $fillable = [
        'shipment_id',
        'status',
        'location',
        'logged_at',
        'raw_response',
    ];

    protected function casts(): array
    {
        return [
            'logged_at' => 'datetime',
            'raw_response' => 'array',
        ];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }
}
