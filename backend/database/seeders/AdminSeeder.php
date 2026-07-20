<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $name = trim((string) config(
            'services.smartcommerce_admin.name',
            'SmartCommerce Administrator'
        ));
        $email = trim((string) config('services.smartcommerce_admin.email'));
        $password = (string) config('services.smartcommerce_admin.password');

        if ($email === '' || $password === '') {
            $message = 'SMARTCOMMERCE_ADMIN_EMAIL and SMARTCOMMERCE_ADMIN_PASSWORD must be configured before seeding the administrator.';

            if (app()->isProduction()) {
                throw new RuntimeException($message);
            }

            $this->command?->warn($message . ' Administrator creation skipped.');

            return;
        }

        $existingUser = User::where('email', $email)->first();

        if ($existingUser !== null) {
            if ($existingUser->role !== 'admin') {
                throw new RuntimeException(
                    'The configured administrator email already belongs to a non-admin user.'
                );
            }

            $this->command?->info('Administrator already exists; credentials were left unchanged.');

            return;
        }

        User::create([
            'name' => $name !== '' ? $name : 'SmartCommerce Administrator',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'admin',
        ]);
    }
}
