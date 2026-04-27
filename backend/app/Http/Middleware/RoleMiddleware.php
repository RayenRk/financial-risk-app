<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! in_array($request->user()->role, $roles)) {
            return response()->json([
                'message' => 'Unauthorized. You do not have permission to access this resource.',
                'your_role'     => $request->user()->role,
                'required_roles' => $roles,
            ], 403);
        }

        return $next($request);
    }
}
