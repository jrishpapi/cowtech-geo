<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

/**
 * 写入默认后台管理员；重复执行不会覆盖已有账号。
 */

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $username = trim((string) env('GEOFLOW_ADMIN_USERNAME', 'admin')) ?: 'admin';
        $email = trim((string) env('GEOFLOW_ADMIN_EMAIL', 'admin@example.com')) ?: 'admin@example.com';
        $exists = Admin::query()->where('username', $username)->exists();

        if ($exists) {
            $this->command?->info('CowTech default admin already exists; seeding skipped without overwriting credentials.');

            return;
        }

        $password = (string) env('GEOFLOW_ADMIN_PASSWORD', '');

        if ($password === '') {
            if (app()->environment('production')) {
                throw new RuntimeException('GEOFLOW_ADMIN_PASSWORD must be explicitly configured before creating a production administrator.');
            } else {
                $password = 'password';
            }
        }

        Admin::query()->create([
            'username' => $username,
            'email' => $email,
            'password' => $password,
            'display_name' => 'Administrator',
            'role' => 'super_admin',
            'status' => 'active',
        ]);
    }
}
