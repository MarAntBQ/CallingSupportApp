<?php

declare(strict_types=1);

$config = require dirname(__DIR__, 2) . '/config/contact.php';
$pdo = new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$deleted = $pdo->prepare('DELETE FROM contact_messages WHERE created_at < (NOW() - INTERVAL ? DAY)');
$deleted->execute([(int) $config['retention_days']]);
echo date('c'), ' contact-purge: ', $deleted->rowCount(), " mensaje(s) borrado(s)\n";
