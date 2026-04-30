<?php

namespace App\Notifications;

use App\Mail\RiskAlertMail;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RiskAlertNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $companyName,
        public string $ticker,
        public string $previousRisk,
        public string $currentRisk,
        public string $quarterDate,
        public float  $confidence,
        public array  $topDrivers,
        public string $severity,
        public string $message,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): RiskAlertMail
    {
        return (new RiskAlertMail(
            companyName:  $this->companyName,
            ticker:       $this->ticker,
            previousRisk: $this->previousRisk,
            currentRisk:  $this->currentRisk,
            quarterDate:  $this->quarterDate,
            confidence:   $this->confidence,
            topDrivers:   $this->topDrivers,
        ))->to($notifiable->email, $notifiable->name);
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'company_name'  => $this->companyName,
            'ticker'        => $this->ticker,
            'previous_risk' => $this->previousRisk,
            'current_risk'  => $this->currentRisk,
            'quarter_date'  => $this->quarterDate,
            'confidence'    => $this->confidence,
            'top_drivers'   => $this->topDrivers,
            'severity'      => $this->severity,
            'message'       => $this->message,
        ];
    }
}
