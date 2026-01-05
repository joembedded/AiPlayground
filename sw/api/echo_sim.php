<?php
/**
 * echo_sim.php - (C) JoEmbedded - 01.01.2026
 * Simple Echo-Simulater with states
 * Receives chat via POST Reply as JSON
 * http://localhost/wrk/ai/playground/sw/api/echo_sim.php?sessionid=dea1de3b866853f2238abc9fbbc5766a&user=testuser 
 */

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, 1: Logfile schreiben 2: Log complete Reply
$xlog = "echo_sim"; // Debug-Ausgaben sammeln
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
$apiKey = OPENAI_API_KEY;
$dataDir = __DIR__ . '/../../' . USERDIR . '/users';
//$userDir = $dataDir + $user // later..

try {
    // Simulate processing time
    sleep(2);
    // Validate and sanitize user
    $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
    if (strlen($user) < 6 || strlen($user) > 32) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }
    $userDir = $dataDir . '/' . $user;
    $xlog .= " User:'$user'";

    $sessionId = $_REQUEST['sessionid'] ?? '';
    $accessFile = $userDir . '/access.json.php';
    if( strlen($sessionId) == 32 && file_exists($accessFile)) {
        $access = json_decode(file_get_contents($accessFile), true);
    }
    if (empty($access) || (@$access['sessionId'] !== $sessionId) ) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }
    // $xlog .= " SessionID:'$sessionId'";

    // Vorlese-Text (z. B. aus POST/GET)
    $text = trim(str_replace(["\r\n", "\n", "\r"], ' ', $_REQUEST['text'] ?? ''), " \n\r\t\v\0\"");
    if (!$text) {
        http_response_code(400);
        throw new Exception('ERROR: Kein Text');
    }

    $xlog .= " Text:'$text'";

    /*****
    // Call OpenAI STT API
    $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey],
        CURLOPT_POSTFIELDS => [
            'model' => 'gpt-4o-mini-transcribe',
            'language' => substr($lang, 0, 2),
            'file' => new CURLFile($file['tmp_name'], $file['type'], $file['name']),
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    // curl_close($ch); deprecated

    if ($response === false) {
        throw new Exception('cURL error: ' . curl_error($ch));
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        throw new Exception("cURL HTTP $httpCode: $response");
    }
     *****/
    $response = '{ "text": "Echo: ' . $text . '" }';
    $httpCode = 200;

    // Log response - Chats liegen in Subdir
    if ($log > 1) {
        $chatDir = $userDir . '/chat';
        if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
            http_response_code(500);
            throw new Exception('Failed to create user/chat directory');
        }
        file_put_contents($chatDir . '/chat_' . date('Ymd_His') . '.json', $response);
    }

    $xlog .= " Response:'$response'";

    // Extract transcription text
    $data = json_decode($response, true);

    http_response_code(201); // Success - Was Neues
    $reply = json_decode($response, true);
    echo json_encode(['success' => true, 'text' => $reply['text'] ?? ''], JSON_UNESCAPED_SLASHES);
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
