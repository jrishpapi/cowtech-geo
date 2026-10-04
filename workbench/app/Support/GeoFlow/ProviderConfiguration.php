<?php

namespace App\Support\GeoFlow;

use RuntimeException;

final class ProviderConfiguration
{
    public static function requireMode(string $configKey): string
    {
        $mode = trim((string) config($configKey, 'unconfigured'));
        if ($mode === '' || $mode === 'unconfigured') {
            throw new RuntimeException('AI provider is not configured. Configure your own provider before running this operation.');
        }
        if ($mode === 'mock' && ! app()->runningUnitTests()) {
            throw new RuntimeException('Mock providers are restricted to automated tests.');
        }

        return $mode;
    }
}
