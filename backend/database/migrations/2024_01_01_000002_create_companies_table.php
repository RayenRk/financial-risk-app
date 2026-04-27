<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('ticker')->unique();
            $table->string('name');
            $table->string('sector')->nullable();
            $table->string('industry')->nullable();
            $table->string('country')->nullable();
            $table->bigInteger('employees')->nullable();
            $table->bigInteger('market_cap')->nullable();
            $table->string('website')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
