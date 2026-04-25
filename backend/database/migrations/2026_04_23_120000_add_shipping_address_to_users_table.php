<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('address_street')->nullable()->after('role');
            $table->string('address_street2')->nullable();
            $table->string('address_city')->nullable();
            $table->string('address_state', 8)->nullable();
            $table->string('address_postal_code', 32)->nullable();
            $table->string('address_country', 8)->nullable()->default('US');
            $table->string('address_company')->nullable();
            $table->string('phone', 32)->nullable();
            $table->boolean('profile_completed')->default(false);
            $table->boolean('address_fedex_verified')->default(false);
            $table->timestamp('profile_completed_at')->nullable();
        });

        // Existing accounts should not be forced through the modal; new users keep default false.
        $now = now();
        DB::table('users')->update([
            'profile_completed' => true,
            'profile_completed_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'address_street',
                'address_street2',
                'address_city',
                'address_state',
                'address_postal_code',
                'address_country',
                'address_company',
                'phone',
                'profile_completed',
                'address_fedex_verified',
                'profile_completed_at',
            ]);
        });
    }
};
