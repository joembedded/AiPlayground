<?php
/**
 * login.php - (C) JoEmbedded - 04.01.2026
 * Get sessionID and user settings
 * Receives data via GET/POST Reply as JSON
 * Das ist der Grosse Login, startet eine session und hinterlegt sessionID Hash fuer user
 * http://localhost/wrk/ai/playground/sw/api/login.php?user=testuser&password=12345678
*/

declare(strict_types=1);

// Configuration
$xlog = "login"; // Debug-Ausgaben sammeln
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

// Load API keys
include_once __DIR__ . '/../secret/keys.inc.php';
$dataDir = __DIR__ . '/../../' . USERDIR . '/users';
//$userDir = $dataDir + $user // later..

try {

    // Validate and sanitize user
    $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
    if (strlen($user) < 6 || strlen($user) > 32) {
        http_response_code(400);
        throw new Exception('User must be 6-32 characters');
    }
    $userDir = $dataDir . '/' . $user;
    $xlog .= " User:'$user'";
    // Validate and sanitize user's password
    $password = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['password'] ?? '_unknown');
    if (strlen($password) < 8 || strlen($password) > 32) {
        http_response_code(400);
        throw new Exception('Password must be 8-32 characters');
    }
    $xlog .= " Password:'$password'";

    // Check user directory (nicht anlegen!) ***
    if (!is_dir($userDir) /* && !mkdir($userDir, 0755, true)*/) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }

    $credentialsFile = $userDir . '/credentials.json';
    if (file_exists($credentialsFile)) {
        $credentials = json_decode(file_get_contents($credentialsFile), true);
    }
    if (! !empty($credentials)) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }
    if (@$credentials['password'] !== $password) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }

    $sessionId = bin2hex(random_bytes(16)); // 32 Zeichen Session-ID
    $xlog .= " SessionId:'$sessionId'";

    // Save credentials and access time
    file_put_contents(
        $userDir . '/access.json',
        json_encode([
            'date' => date('Y-m-d H:i:s'),
            'sessionId' => $sessionId
        ], JSON_UNESCAPED_SLASHES)
    );

    // komplette credentials erzeugen  - Wie logrem.php!
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
        'user' => $user,
        'text' => "Hallo $user!",   // Begruessungsnachricht
        'sessionId' => $sessionId,
        'userLang' => $userLang,
        'helpTexts' => $helpTxts,
        'speakVoice' => 'narrator_f_jane', // Voice 
    ];

    session_start();
    session_regenerate_id(true);
    $_SESSION["user"] = $user;
    $_SESSION["sessionId"] = $sessionId;
    $_SESSION["login_time"] = time();

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
    if ( !empty($ip))  $xlog = "IP:$ip " . $xlog;
}
log2file($xlog);
