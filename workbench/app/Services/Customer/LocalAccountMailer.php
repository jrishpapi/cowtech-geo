<?php

namespace App\Services\Customer;

use App\Mail\LocalAccountMessage;
use Illuminate\Support\Facades\Mail;

class LocalAccountMailer
{
    public function assertConfigured(): void
    {
        $mailer = (string) config('mail.default', '');
        $transport = (string) config('mail.mailers.'.$mailer.'.transport', '');
        if ($transport === '' || (! app()->runningUnitTests() && in_array($transport, ['log', 'array'], true))) {
            throw new \RuntimeException('Configure your own delivery mail service before using account email verification.');
        }
    }

    public function send(string $email, string $subject, string $message): void
    {
        $this->assertConfigured();
        Mail::to($email)->send(new LocalAccountMessage($subject, $message));
    }
}
