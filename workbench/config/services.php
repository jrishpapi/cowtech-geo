<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

/**
 * 第三方服务凭证占位（Mail/Postmark/SES/Resend/Slack 等）。
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'aivgl' => [
        'base_url' => env('AIVGL_DASHBOARD_BASE_URL', ''),
        'brand_name' => env('AIVGL_DASHBOARD_BRAND_NAME', ''),
        'tracking_run_id' => env('AIVGL_DASHBOARD_TRACKING_RUN_ID', ''),
        'discovery_run_id' => env('AIVGL_DASHBOARD_DISCOVERY_RUN_ID', ''),
        'timeout_seconds' => env('AIVGL_DASHBOARD_TIMEOUT_SECONDS', 4),
        'retest_delay_hours' => env('AIVGL_RETEST_DELAY_HOURS', 24),
        'retest_timeout_seconds' => env('AIVGL_RETEST_TIMEOUT_SECONDS', 180),
        'customer_plan_code' => env('AIVGL_CUSTOMER_PLAN_CODE', 'starter'),
        'customer_provider_mode' => env('AIVGL_CUSTOMER_PROVIDER_MODE', 'unconfigured'),
        'customer_monitoring_provider_mode' => env('AIVGL_CUSTOMER_MONITORING_PROVIDER_MODE', 'contract'),
        'customer_allow_paid_provider' => env('AIVGL_CUSTOMER_ALLOW_PAID_PROVIDER', false),
        'customer_monitoring_allow_paid_provider' => env('AIVGL_CUSTOMER_MONITORING_ALLOW_PAID_PROVIDER', false),
        'internal_admin_token' => env('AIVGL_INTERNAL_ADMIN_TOKEN', ''),
        'deep_article_provider_mode' => env('AIVGL_DEEP_ARTICLE_PROVIDER_MODE', 'unconfigured'),
        'deep_article_allow_paid_provider' => env('AIVGL_DEEP_ARTICLE_ALLOW_PAID_PROVIDER', false),
        'deep_article_timeout_seconds' => env('AIVGL_DEEP_ARTICLE_TIMEOUT_SECONDS', 45),
        'deep_article_fail_open' => env('AIVGL_DEEP_ARTICLE_FAIL_OPEN', false),
    ],

    'cowtech' => [
        'deployment_mode' => env('COWTECH_DEPLOYMENT_MODE', 'self_hosted'),
        'self_hosted_plan_code' => env('COWTECH_SELF_HOSTED_PLAN_CODE', 'god'),
        'entitlement_bridge_secret' => env('COWTECH_ENTITLEMENT_BRIDGE_SECRET', ''),
        'api_base_url' => env('COWTECH_API_BASE_URL', ''),
        'timeout_seconds' => env('COWTECH_API_TIMEOUT_SECONDS', 10),
        'launch_pack_timeout_seconds' => env('COWTECH_LAUNCH_PACK_TIMEOUT_SECONDS', 60),
    ],

];
