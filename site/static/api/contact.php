<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

require __DIR__ . '/lib/PHPMailer/Exception.php';
require __DIR__ . '/lib/PHPMailer/PHPMailer.php';
require __DIR__ . '/lib/PHPMailer/SMTP.php';

const LANGS = ['es', 'pt', 'en'];
const MAX_BODY = 20000;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $code): never
{
    respond($status, ['ok' => false, 'error' => $code]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'method');
}
if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    fail(415, 'content-type');
}

$configFile = dirname(__DIR__, 4) . '/config/contact.php';
$config = is_readable($configFile) ? require $configFile : null;
if (!is_array($config)) {
    error_log('contact: no se encontró la configuración');
    fail(503, 'unavailable');
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if (!is_string($raw) || strlen($raw) > MAX_BODY) {
    fail(413, 'too-large');
}
$input = json_decode($raw, true);
if (!is_array($input)) {
    fail(400, 'json');
}

$text = static fn (string $key): string => is_string($input[$key] ?? null) ? trim($input[$key]) : '';
$name = $text('name');
$email = $text('email');
$message = $text('message');
$lang = $text('lang');
$token = $text('token');
$honeypot = $text('website');
$consent = ($input['consent'] ?? false) === true;
$policyVersion = $text('policyVersion');

if ($honeypot !== '') {
    respond(200, ['ok' => true]);
}

$length = static fn (string $s): int => mb_strlen($s, 'UTF-8');
$hasBreak = static fn (string $s): bool => preg_match('/[\r\n]/', $s) === 1;

if ($length($name) < 2 || $length($name) > 100 || $hasBreak($name)) {
    fail(422, 'name');
}
if ($length($email) > 254 || $hasBreak($email) || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fail(422, 'email');
}
if ($length($message) < 10 || $length($message) > 2000) {
    fail(422, 'message');
}
if (!in_array($lang, LANGS, true)) {
    fail(422, 'lang');
}
if (!$consent || preg_match('/^\d{4}-\d{2}-\d{2}$/', $policyVersion) !== 1) {
    fail(422, 'consent');
}
if ($token === '' || strlen($token) > 4000) {
    fail(403, 'captcha');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$ipHash = hash('sha256', $ip . '|' . $config['ip_salt']);

$curl = curl_init('https://www.google.com/recaptcha/api/siteverify');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'secret' => $config['recaptcha']['secret'],
        'response' => $token,
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 5,
]);
$verifyBody = curl_exec($curl);
$verifyStatus = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
$verify = is_string($verifyBody) ? json_decode($verifyBody, true) : null;
$score = is_array($verify) && is_numeric($verify['score'] ?? null) ? (float) $verify['score'] : 0.0;

if (
    $verifyStatus !== 200
    || !is_array($verify)
    || ($verify['success'] ?? false) !== true
    || ($verify['action'] ?? '') !== $config['recaptcha']['action']
    || $score < (float) $config['recaptcha']['min_score']
    || !in_array($verify['hostname'] ?? '', $config['recaptcha']['hostnames'], true)
) {
    fail(403, 'captcha');
}

$lockName = 'contact:' . substr($ipHash, 0, 32);
try {
    $pdo = new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 5)');
    $lock->execute([$lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        fail(503, 'unavailable');
    }
    $recent = $pdo->prepare('SELECT COUNT(*) FROM contact_messages WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL 1 HOUR)');
    $recent->execute([$ipHash]);
    if ((int) $recent->fetchColumn() >= (int) $config['rate_limit_per_hour']) {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
        fail(429, 'rate');
    }
    $insert = $pdo->prepare('INSERT INTO contact_messages (lang, name, email, message, ip_hash, score, consent, policy_version) VALUES (?, ?, ?, ?, ?, ?, 1, ?)');
    $insert->execute([$lang, $name, $email, $message, $ipHash, round($score, 2), $policyVersion]);
    $id = (int) $pdo->lastInsertId();
    $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    $pdo->prepare('DELETE FROM contact_messages WHERE created_at < (NOW() - INTERVAL ? DAY)')
        ->execute([(int) $config['retention_days']]);
} catch (PDOException $e) {
    error_log('contact: la base de datos falló (' . $e->getCode() . ')');
    fail(503, 'unavailable');
}

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = $config['smtp']['host'];
    $mail->Port = (int) $config['smtp']['port'];
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Username = $config['smtp']['user'];
    $mail->Password = $config['smtp']['pass'];
    $mail->Timeout = 15;
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->setFrom($config['mail']['from'], $config['mail']['from_name']);
    $mail->addAddress($config['mail']['to']);
    $mail->addReplyTo($email, $name);
    $mail->isHTML(false);
    $mail->Subject = "[Contacto {$lang}] {$name}";
    $mail->Body = "Nombre: {$name}\nCorreo: {$email}\nIdioma del sitio: {$lang}\n\n{$message}\n\n--\nMensaje #{$id} enviado desde https://callingsupportapp.org/contact/\nPara responder, usa «Responder»: va directo a quien escribió.";
    $mail->send();
    $pdo->prepare('UPDATE contact_messages SET mailed = 1 WHERE id = ?')->execute([$id]);
} catch (MailException $e) {
    error_log('contact: el correo del mensaje #' . $id . ' no salió: ' . $mail->ErrorInfo);
    fail(502, 'mail');
}

respond(200, ['ok' => true]);
