<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('fedex_tracking_number')->nullable();
            $table->string('label_path')->nullable();
            $table->string('service_type', 64)->nullable();
            $table->string('pickup_type', 64)->default('USE_SCHEDULED_PICKUP');
            $table->decimal('package_weight', 8, 2)->nullable();
            $table->json('package_dimensions')->nullable();
            $table->boolean('is_residential')->default(false);
            $table->string('fedex_transaction_id')->nullable();
            $table->string('fedex_job_id')->nullable();
            $table->timestamp('shipped_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'fedex_tracking_number',
                'label_path',
                'service_type',
                'pickup_type',
                'package_weight',
                'package_dimensions',
                'is_residential',
                'fedex_transaction_id',
                'fedex_job_id',
                'shipped_at',
            ]);
        });
    }
};
