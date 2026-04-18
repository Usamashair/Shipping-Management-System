<?php

namespace App\Console\Commands;

use App\Models\Shipment;
use Illuminate\Console\Command;

class PollShipmentTracking extends Command
{
    protected $signature = 'shipments:poll-tracking';

    protected $description = 'Stub: poll FedEx for active shipments (wire HttpFedExClient + queue later).';

    public function handle(): int
    {
        $count = Shipment::query()->whereIn('status', ['pending', 'in_transit'])->count();
        $this->info("Active shipments (pending/in_transit): {$count} (no polling in stub mode).");

        return self::SUCCESS;
    }
}
