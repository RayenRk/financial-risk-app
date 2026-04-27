<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    // GET /api/users — list all users (admin only)
    public function index()
    {
        $users = User::select('id', 'name', 'email', 'role', 'created_at')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'users' => $users,
            'count' => $users->count(),
        ]);
    }

    // GET /api/users/{id} — get single user (admin only)
    public function show(int $id)
    {
        $user = User::select('id', 'name', 'email', 'role', 'created_at')
            ->findOrFail($id);

        return response()->json($user);
    }

    // PATCH /api/users/{id} — update user (admin only)
    public function update(Request $request, int $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name'     => ['sometimes', 'string', 'max:255'],
            'email'    => ['sometimes', 'email', 'unique:users,email,' . $id],
            'role'     => ['sometimes', 'in:admin,analyst'],
            'password' => ['sometimes', 'confirmed', Password::min(8)->mixedCase()->numbers()],
        ]);

        $data = $request->only(['name', 'email', 'role']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return response()->json([
            'message' => 'User updated successfully.',
            'user'    => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $user->role,
            ],
        ]);
    }

    // DELETE /api/users/{id} — delete user (admin only)
    public function destroy(Request $request, int $id)
    {
        // Prevent admin from deleting themselves
        if ($request->user()->id === $id) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 403);
        }

        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => "User {$user->name} deleted successfully.",
        ]);
    }
}
