<?php

namespace App\Providers;

use App\Contracts\FedEx\FedExClient;
use App\Services\FedEx\FedExOAuthToken;
use App\Services\FedEx\FedExShipmentCreateService;
use App\Services\FedEx\RestFedExClient;
use App\Services\FedEx\StubFedExClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(FedExClient::class, function () {
            if (config('fedex.mode') === 'rest' && FedExShipmentCreateService::isConfigured()) {
                return new RestFedExClient($this->app->make(FedExOAuthToken::class));
            }

            return new StubFedExClient;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });
    }
}
