<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401);
        }

        $role = strtolower((string) ($user->role ?? ''));

        if ($role !== 'admin') {
            abort(403, 'Accès réservé à l’administrateur.');
        }

        return $next($request);
    }
}