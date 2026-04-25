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
            $table->boolean('address_saved')->default(false)->after('address_fedex_verified');
            $table->timestamp('address_saved_at')->nullable();
            $table->timestamp('address_verified_at')->nullable();
        });

        $rows = DB::table('users')->select([
            'id',
            'address_street',
            'address_city',
            'address_state',
            'address_postal_code',
            'profile_completed',
            'profile_completed_at',
            'address_fedex_verified',
            'updated_at',
        ])->get();

        foreach ($rows as $u) {
            $hasAddr = filled($u->address_street)
                && filled($u->address_city)
                && filled($u->address_state)
                && filled($u->address_postal_code);
            $saved = (bool) $u->profile_completed || $hasAddr;
            $savedAt = $saved
                ? ($u->profile_completed_at ?? $u->updated_at ?? now())
                : null;
            $verifiedAt = ($saved && (bool) $u->address_fedex_verified)
                ? ($u->profile_completed_at ?? now())
                : null;

            DB::table('users')->where('id', $u->id)->update([
                'address_saved' => $saved,
                'address_saved_at' => $savedAt,
                'address_verified_at' => $verifiedAt,
            ]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['profile_completed', 'profile_completed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('profile_completed')->default(false);
            $table->timestamp('profile_completed_at')->nullable();
        });

        DB::table('users')->where('address_saved', true)->update([
            'profile_completed' => true,
            'profile_completed_at' => DB::raw('COALESCE(address_saved_at, updated_at)'),
        ]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'address_saved',
                'address_saved_at',
                'address_verified_at',
            ]);
        });
    }
};
