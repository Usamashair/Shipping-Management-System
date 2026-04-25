<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AppSettingsSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('app_settings')->where('key', 'fixed_recipient')->exists()) {
            return;
        }

        DB::table('app_settings')->insert([
            'key' => 'fixed_recipient',
            'description' => 'Fixed shipment recipient — all customer shipments go here',
            'value' => json_encode([
                'personName' => 'Danny Mita',
                'companyName' => 'Mobile Pros LLC',
                'phoneNumber' => '9172511533',
                'email' => 'danny@mobileprosllc.com',
                'address' => [
                    'streetLines' => ['174 Main Ave'],
                    'city' => 'Wallington',
                    'stateOrProvinceCode' => 'NJ',
                    'postalCode' => '07057',
                    'countryCode' => 'US',
                    'residential' => false,
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
