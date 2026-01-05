<?php
/**
 * oai_stt.php - (C) JoEmbedded - 31.12.2025
 * Receives audio file via POST for OpenAI STT transcription.
 * Optional Parameter dbgpost>0: Nur speichern
 */

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, 1: Logfile schreiben 2:Upload speichern
$xlog = "oas_stt"; // Debug-Ausgaben sammeln
include_once __DIR__ . '/../php_tools/logfile.php';

$maxFileSize = 1024 * 1024; // 1 MB
$allowedMimeTypes = ['audio/webm', 'audio/ogg', 'audio/mpeg'];

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
$uploadDir = __DIR__ . '/../../' . USERDIR . '/audio/uploads';
$dataDir = __DIR__ . '/../../' . USERDIR . '/users';

try {
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
    if (strlen($sessionId) == 32 && file_exists($accessFile)) {
        $access = json_decode(file_get_contents($accessFile), true);
    }
    if (! !empty($access) || (@$access['sessionId'] !== $sessionId)) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }
    // $xlog .= " SessionID:'$sessionId'";

    // Validate language
    $lang = $_REQUEST['lang'] ?? 'de-DE';
    if (!preg_match('/^[a-z]{2}(-[A-Z]{2})?$/', $lang)) {
        http_response_code(400);
        throw new Exception('Invalid language format (expected: xx or xx-XX)');
    }
    $xlog .= " Lang:'$lang'";

    // Validate prerequisites
    if (!$apiKey) {
        http_response_code(500);
        throw new Exception('OPENAI_API_KEY missing');
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        throw new Exception('Method not allowed');
    }


    // Validate file upload
    if (! !empty($_FILES['audio'])) {
        http_response_code(400);
        throw new Exception('No audio content');
    }

    $dbgpost = (int)($_POST['dbgpost'] ?? 0);
    $file = $_FILES['audio'];

    // Check upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'File partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Temp directory missing',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
            UPLOAD_ERR_EXTENSION => 'Upload stopped by extension'
        ];
        throw new Exception($errorMessages[$file['error']] ?? 'Upload error: ' . $file['error']);
    }

    // Validate file constraints
    if ($file['size'] > $maxFileSize) {
        http_response_code(413);
        throw new Exception('File too large (Max: ' . ($maxFileSize / 1024 / 1024) . ' MB)');
    }
    if (!in_array($file['type'], $allowedMimeTypes, true)) {
        http_response_code(400);
        throw new Exception('Invalid file type: ' . $file['type']);
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        throw new Exception('Invalid upload file');
    }

    // Save file for logging - Problem: OGG / WEBM / OPUS, immer das selbe...
    if ($log > 0) {
        $extension = match ($file['type']) {
            'audio/webm' => 'opus', // Im Prinzip wäre .webm 'korrekter', aber Audacity meckert .webm an
            'audio/ogg' => 'ogg',
            'audio/mpeg' => 'mp3',
            default => 'dat'
        };
        $timestamp = date('Ymd_His');
        $filename = 'audio_' . $timestamp . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        if ($dbgpost > 0) $filename = 'dbg_' . $filename;
        $filepath = $uploadDir . '/' . $filename;

        // Create upload directory
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            throw new Exception('Failed to create upload directory');
        }

        if (!copy($file['tmp_name'], $filepath)) {
            http_response_code(500);
            throw new Exception('Failed to save file');
        }
    }

    // Debug mode: only save file
    if ($dbgpost > 0) {
        http_response_code(201); // Success - Was Neues
        echo json_encode([
            'success' => true,
            'message' => 'File uploaded for debugging',
            'filename' => $filename ?? '(null)'
        ], JSON_UNESCAPED_SLASHES);
        $xlog .= " DbgPost:'$filename'";
        log2file($xlog);
        exit;
    }

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


    // Log response
    if ($log > 1) {
        file_put_contents($uploadDir . '/stt_' . $filename . '.json', $response);
    }

    // Extract transcription text
    $data = json_decode($response, true);
    $stt = $data['text'] ?? $response;

    $xlog .= " Text:'$stt'";

    http_response_code(201); // Success - Was Neues
    echo json_encode(['success' => true, 'text' => $stt], JSON_UNESCAPED_SLASHES);
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
