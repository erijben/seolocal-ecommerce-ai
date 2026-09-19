<?php

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

    'smartcommerce_admin' => [
        'name' => env('SMARTCOMMERCE_ADMIN_NAME', 'SmartCommerce Administrator'),
        'email' => env('SMARTCOMMERCE_ADMIN_EMAIL'),
        'password' => env('SMARTCOMMERCE_ADMIN_PASSWORD'),
    ],

    'ml_service' => [
        'url' => env('ML_SERVICE_URL', 'http://127.0.0.1:8001'),
        'forecast_horizon_days' => env('ML_FORECAST_HORIZON_DAYS', 30),
        'timeout' => env('ML_SERVICE_TIMEOUT', 30),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
        'temperature' => env('OPENAI_TEMPERATURE', 0.2),
        'max_output_tokens' => env('OPENAI_MAX_OUTPUT_TOKENS', 900),
        'timeout' => env('OPENAI_TIMEOUT', 60),
    ],

    'ai' => [
        'provider' => env('AI_PROVIDER', 'ollama'),
        'allow_provider_fallback' => filter_var(
            env('AI_ALLOW_PROVIDER_FALLBACK', false),
            FILTER_VALIDATE_BOOLEAN
        ),
    ],

    'ai_microservice' => [
    'enabled' => filter_var(
        env('AI_MICROSERVICE_ENABLED', false),
        FILTER_VALIDATE_BOOLEAN
    ),
    'legacy_fallback_enabled' => filter_var(
        env('AI_MICROSERVICE_LEGACY_FALLBACK_ENABLED', false),
        FILTER_VALIDATE_BOOLEAN
    ),
    'base_url' => rtrim(
        env(
            'AI_MICROSERVICE_BASE_URL',
            'http://127.0.0.1:8002'
        ),
        '/'
    ),
    'api_key' => env('AI_MICROSERVICE_API_KEY'),
    'connect_timeout' => (int) env(
        'AI_MICROSERVICE_CONNECT_TIMEOUT',
        3
    ),
    'timeout' => (int) env(
        'AI_MICROSERVICE_TIMEOUT',
        180
    ),
],


        'ollama' => [
        'url' => env('OLLAMA_URL', 'http://127.0.0.1:11434'),
        'model' => env('OLLAMA_MODEL', 'llama3.2:1b'),
        'temperature' => env('OLLAMA_TEMPERATURE', 0.2),
        'timeout' => env('OLLAMA_TIMEOUT', 120),
        'report_timeout' => env('OLLAMA_REPORT_TIMEOUT', 120),
        'keep_alive' => env('OLLAMA_KEEP_ALIVE', '30m'),
        'num_predict' => env('OLLAMA_NUM_PREDICT', 240),
        'num_ctx' => env('OLLAMA_NUM_CTX', 1024),
        'report_num_predict' => env('OLLAMA_REPORT_NUM_PREDICT', 220),
        'report_num_ctx' => env('OLLAMA_REPORT_NUM_CTX', 4096),
    ],

];
