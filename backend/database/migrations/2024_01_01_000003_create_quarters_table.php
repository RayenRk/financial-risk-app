<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quarters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->date('quarter_date');

            // Raw financials (stored in millions)
            $table->decimal('revenue', 15, 2)->nullable();
            $table->decimal('gross_profit', 15, 2)->nullable();
            $table->decimal('operating_income', 15, 2)->nullable();
            $table->decimal('net_income', 15, 2)->nullable();
            $table->decimal('free_cash_flow', 15, 2)->nullable();
            $table->decimal('total_debt', 15, 2)->nullable();
            $table->decimal('cash', 15, 2)->nullable();
            $table->decimal('total_assets', 15, 2)->nullable();
            $table->decimal('total_equity', 15, 2)->nullable();
            $table->decimal('operating_cash_flow', 15, 2)->nullable();

            // Engineered ratios
            $table->decimal('gross_margin', 8, 4)->nullable();
            $table->decimal('operating_margin', 8, 4)->nullable();
            $table->decimal('net_margin', 8, 4)->nullable();
            $table->decimal('fcf_margin', 8, 4)->nullable();
            $table->decimal('roe', 8, 4)->nullable();
            $table->decimal('roa', 8, 4)->nullable();
            $table->decimal('debt_to_equity', 8, 4)->nullable();
            $table->decimal('current_ratio', 8, 4)->nullable();
            $table->decimal('interest_coverage', 8, 4)->nullable();
            $table->decimal('asset_turnover', 8, 4)->nullable();
            $table->decimal('revenue_growth_yoy', 8, 4)->nullable();

            $table->unique(['company_id', 'quarter_date']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quarters');
    }
};
