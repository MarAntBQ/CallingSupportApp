<?php
return [
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=;charset=utf8mb4',
        'user' => '',
        'pass' => '',
    ],
    'recaptcha' => [
        'secret' => '',
        'min_score' => 0.5,
        'action' => 'contact',
        'hostnames' => ['callingsupportapp.org', 'noticiaslaureles.org', 'localhost'],
    ],
    'smtp' => [
        'host' => 'mail.callingsupportapp.org',
        'port' => 587,
        'user' => 'noreply@callingsupportapp.org',
        'pass' => '',
    ],
    'mail' => [
        'from' => 'noreply@callingsupportapp.org',
        'from_name' => 'CallingSupportApp',
        'to' => 'devteam@callingsupportapp.org',
    ],
    'ip_salt' => '',
    'rate_limit_per_hour' => 5,
    'retention_days' => 90,
];
