<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RiskAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $companyName,
        public string $ticker,
        public string $previousRisk,
        public string $currentRisk,
        public string $quarterDate,
        public float  $confidence,
        public array  $topDrivers,
    ) {}

    public function envelope(): Envelope
    {
        $emoji = match($this->currentRisk) {
            'high_risk'   => '🔴',
            'medium_risk' => '🟡',
            default       => '🟢',
        };

        return new Envelope(
            subject: "{$emoji} {$this->companyName} Risk Alert — " .
                     ucwords(str_replace('_', ' ', $this->currentRisk)),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.risk-alert',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
