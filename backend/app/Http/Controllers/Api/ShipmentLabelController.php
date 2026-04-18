<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ShipmentLabelController extends Controller
{
    public function download(Shipment $shipment): StreamedResponse|Response
    {
        $this->authorize('downloadLabel', $shipment);

        if ($shipment->label_path === null || $shipment->label_path === '') {
            abort(404, 'No label file on record.');
        }

        if (! Storage::disk('labels')->exists($shipment->label_path)) {
            abort(404, 'Label file missing.');
        }

        return Storage::disk('labels')->response(
            $shipment->label_path,
            'shipment-'.$shipment->id.'-label.pdf',
            ['Content-Type' => 'application/pdf'],
        );
    }
}
