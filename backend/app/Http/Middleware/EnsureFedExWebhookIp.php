<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Optional allowlist for FedEx Tracking Webhook source IPs (config fedex.webhook_allowed_ips).
 * Empty list = allow all (typical for local development).
 */
class EnsureFedExWebhookIp
{
    public function handle(Request $request, Closure $next): Response
    {
        $allowed = config('fedex.webhook_allowed_ips', []);
        if (! is_array($allowed) || $allowed === []) {
            return $next($request);
        }

        $ip = $request->ip();
        if (! is_string($ip) || ! in_array($ip, $allowed, true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
