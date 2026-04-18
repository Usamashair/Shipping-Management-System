<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Local-only demo accounts (change in production):
     * - admin@shipdemo.local / password
     * - jane@shipdemo.local / password
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@shipdemo.local'],
            [
                'name' => 'Alex Admin',
                'password' => 'password',
                'role' => 'admin',
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'jane@shipdemo.local'],
            [
                'name' => 'Jane Customer',
                'password' => 'password',
                'role' => 'customer',
            ],
        );
    }
}
