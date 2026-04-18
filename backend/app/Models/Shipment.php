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
        'fedex_tracking_number',
        'sender_details',
        'receiver_details',
        'package_details',
        'status',
        'label_url',
        'label_path',
        'service_type',
        'pickup_type',
        'package_weight',
        'package_dimensions',
        'is_residential',
        'fedex_response',
        'fedex_transaction_id',
        'fedex_job_id',
        'shipped_at',
    ];

    protected function casts(): array
    {
        return [
            'sender_details' => 'array',
            'receiver_details' => 'array',
            'package_details' => 'array',
            'fedex_response' => 'array',
            'package_dimensions' => 'array',
            'is_residential' => 'boolean',
            'package_weight' => 'decimal:2',
            'shipped_at' => 'datetime',
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
