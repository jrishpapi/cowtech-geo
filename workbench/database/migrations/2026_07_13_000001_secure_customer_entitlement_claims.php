<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // `pending_email_verification` is intentionally explicit and exceeds the
        // legacy 20-character status column.
        Schema::table('admins', function (Blueprint $table): void {
            $table->string('status', 40)->default('active')->change();
        });

        if (! Schema::hasColumn('admins', 'email_verified_at')) {
            Schema::table('admins', function (Blueprint $table): void {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            });
        }

        if (Schema::hasTable('customer_billing_entitlements')) {
            Schema::table('customer_billing_entitlements', function (Blueprint $table): void {
                if (! Schema::hasColumn('customer_billing_entitlements', 'admin_id')) {
                    $table->unsignedBigInteger('admin_id')->nullable()->after('id');
                    $table->unique('admin_id', 'customer_entitlements_admin_unique');
                }
                if (! Schema::hasColumn('customer_billing_entitlements', 'claimed_at')) {
                    $table->timestamp('claimed_at')->nullable()->after('admin_id');
                }
            });
        }

        if (! Schema::hasTable('customer_email_claims')) {
            Schema::create('customer_email_claims', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->unsignedBigInteger('admin_id')->index();
                $table->unsignedBigInteger('entitlement_id')->nullable()->index();
                $table->string('provider_order_id', 120);
                $table->string('code_hash', 255);
                $table->timestamp('expires_at')->index();
                $table->unsignedSmallInteger('attempts')->default(0);
                $table->timestamp('last_sent_at')->nullable();
                $table->timestamp('used_at')->nullable()->index();
                $table->timestamps();
            });
        }

        $this->createCustomerEmailUniqueIndexWhenSafe();
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS admins_customer_email_unique');
        Schema::dropIfExists('customer_email_claims');

        if (Schema::hasTable('customer_billing_entitlements')) {
            Schema::table('customer_billing_entitlements', function (Blueprint $table): void {
                if (Schema::hasColumn('customer_billing_entitlements', 'admin_id')) {
                    $table->dropUnique('customer_entitlements_admin_unique');
                    $table->dropColumn('admin_id');
                }
                if (Schema::hasColumn('customer_billing_entitlements', 'claimed_at')) {
                    $table->dropColumn('claimed_at');
                }
            });
        }

        if (Schema::hasColumn('admins', 'email_verified_at')) {
            Schema::table('admins', function (Blueprint $table): void {
                $table->dropColumn('email_verified_at');
            });
        }
    }

    private function createCustomerEmailUniqueIndexWhenSafe(): void
    {
        $duplicates = DB::table('admins')
            ->selectRaw('LOWER(email) AS normalized_email, COUNT(*) AS aggregate')
            ->where('role', 'customer')
            ->where('email', '<>', '')
            ->groupByRaw('LOWER(email)')
            ->havingRaw('COUNT(*) > 1')
            ->exists();
        if (! $duplicates) {
            DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS admins_customer_email_unique ON admins (LOWER(email)) WHERE role = 'customer' AND email <> ''");

            return;
        }

        throw new RuntimeException('Cannot secure customer email claims: duplicate normalized customer emails exist.');
    }
};
