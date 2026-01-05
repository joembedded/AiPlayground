<?php
/**
 * logrem.php - (C) JoEmbedded - 04.01.2026
 * remember sessionID and user settings
 * Receives data via GET/POST Reply as JSON
 * http://localhost/wrk/ai/playground/sw/api/logrem.php
*/

declare(strict_types=1);

// Configuration
$xlog = "logrem"; // Debug-Ausgaben sammeln
include_once __DIR__ . '/../php_tools/logfile.php';

// CORS headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once __DIR__ . '/../secret/keys.inc.php';
$dataDir = __DIR__ . '/../../' . USERDIR . '/users';

try {
    session_start();

    if (!isset($_SESSION["user"])) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }

    $xlog .= " User:'" . $_SESSION["user"] . "'";

    // komplette credentials erzeugen - Wie login.php!
    $userLang = 'de-DE';
    $helpTxts = [
        'Hallo. Wie kann ich helfen?',
        'Kann ich behilflich sein?',
        'Womit kann ich helfen?',
        'Hallo! Was kann ich tun?',
        'Kann ich behilflich sein?',
        'Fragen? Ich helfe gerne.',
        'Was kann ich tun?',
        'Worum geht es?',
    ];

    $response = [
        'success' => true,
        'user' => $_SESSION["user"],
        'text' => "Hallo " . $_SESSION["user"] . "!",   // Begruessungsnachricht
        'sessionId' => $_SESSION["sessionId"],
        'userLang' => $userLang,
        'helpTexts' => $helpTxts,
        'speakVoice' => 'narrator_f_jane', // Voice 
    ];


    http_response_code(201); // Success - Was Neues
    echo json_encode($response, JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    // Error handling
    if (http_response_code() === 200) {
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES);
    $xlog = "ERROR:'" . $e->getMessage() . "' " . $xlog;
    $ip = $_SERVER['REMOTE_ADDR'];
    if (isset($ip))  $xlog = "IP:$ip " . $xlog;
}
log2file($xlog);
