<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    protected $fillable = [
        'user_id',
        'tracking_number',
        'sender_details',
        'receiver_details',
        'package_details',
        'status',
        'label_url',
        'fedex_response',
    ];

    protected function casts(): array
    {
        return [
            'sender_details' => 'array',
            'receiver_details' => 'array',
            'package_details' => 'array',
            'fedex_response' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function trackingLogs(): HasMany
    {
        return $this->hasMany(TrackingLog::class);
    }
}
