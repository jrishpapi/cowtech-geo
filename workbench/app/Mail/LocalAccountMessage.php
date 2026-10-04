<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class LocalAccountMessage extends Mailable
{
    public function __construct(public string $accountSubject, public string $accountMessage) {}

    public function build(): static
    {
        return $this->subject($this->accountSubject)->text('emails.local-account', [
            'accountMessage' => $this->accountMessage,
        ]);
    }
}
