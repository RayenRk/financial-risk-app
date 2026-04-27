<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quarter_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', [
                'high_risk_detected',
                'risk_increased',
                'risk_decreased',
                'negative_margin',
                'low_liquidity',
                'high_leverage',
            ]);
            $table->enum('severity', ['info', 'warning', 'critical']);
            $table->string('message');
            $table->boolean('is_read')->default(false);
            $table->timestamp('triggered_at')->useCurrent();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
