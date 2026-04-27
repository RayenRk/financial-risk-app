<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quarter_id')->constrained()->cascadeOnDelete();
            $table->enum('risk_label', ['low_risk', 'medium_risk', 'high_risk']);
            $table->decimal('confidence', 5, 4);
            $table->decimal('prob_high_risk', 5, 4)->default(0);
            $table->decimal('prob_low_risk', 5, 4)->default(0);
            $table->decimal('prob_medium_risk', 5, 4)->default(0);
            $table->json('top_risk_drivers')->nullable();
            $table->string('model_version')->default('1.0.0');
            $table->timestamp('predicted_at')->useCurrent();
            $table->timestamps();

            $table->unique(['quarter_id', 'model_version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_predictions');
    }
};
