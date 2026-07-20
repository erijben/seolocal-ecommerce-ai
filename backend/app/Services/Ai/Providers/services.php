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

    'ml_service' => [
    'url' => env('ML_SERVICE_URL', 'http://127.0.0.1:8001'),
    'forecast_horizon_days' => env('ML_FORECAST_HORIZON_DAYS', 30),
],

'ai' => [
    'provider' => env('AI_PROVIDER', 'openai'),
],

'openai' => [
    'key' => env('OPENAI_API_KEY'),
    'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
    'temperature' => env('OPENAI_TEMPERATURE', 0.2),
    'max_output_tokens' => env('OPENAI_MAX_OUTPUT_TOKENS', 900),
    'timeout' => env('OPENAI_TIMEOUT', 60),
],

'ollama' => [
    'url' => env('OLLAMA_URL', 'http://127.0.0.1:11434'),
    'model' => env('OLLAMA_MODEL', 'llama3.2'),
    'temperature' => env('OLLAMA_TEMPERATURE', 0.2),
    'timeout' => env('OLLAMA_TIMEOUT', 120),
],
];
