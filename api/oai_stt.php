<?php

/**
 * oai_stt.php - (C) JoEmbedded - 29.12.2025
 * Receives audio file via POST for OpenAI STT transcription.
 * *todo*: AUTH und LANG als parameter
 * Optona Parameter dbgpost>0: Nur speichern
 */

declare(strict_types=1);
$log = 2; // 0: Silent, 1: Log upload (audio .webm) 2: Log upload + response(.json) mit Tokens, resultm ...

// CORS and Content-Type headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
// OPTIONS request for CORS preflight - Wichtig!
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once __DIR__ . '/../secret/keys.inc.php';
$apiKey = OPENAI_API_KEY;
$uploadDir = __DIR__ . '/../audio/uploads'; // fuer logs
$maxFileSize = 1 * 1024 * 1024; // 1 MB
$allowedMimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];

try {
    if (!$apiKey) {
        http_response_code(500);
        throw new Exception('OPENAI_API_KEY missing');
    }
    // Only POST allowed
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        throw new Exception('Method not allowed');
    }

    // Create upload directory - immer gut
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        throw new Exception('Failed to create upload directory');
    }

    // Validation: File present
    if (!isset($_FILES['audio'])) {
        http_response_code(400);
        throw new Exception('No audio content');
    }
    $file = $_FILES['audio'];

    // Validation: Upload error UPLOAD_ERR_OK: 0
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

    // Validation: File size
    if ($file['size'] > $maxFileSize) {
        http_response_code(413);
        throw new Exception('File too large (Max: ' . ($maxFileSize / 1024 / 1024) . ' MB)');
    }

    // Validation: MIME type
    if (!in_array($file['type'], $allowedMimeTypes, true)) {
        http_response_code(400);
        throw new Exception('Invalid file type: ' . $file['type']);
    }

    // Validation: File exists
    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        throw new Exception('Invalid upload file');
    }

    if ($log > 0) {
        // Determine file extension from MIME type
        $extension = match ($file['type']) {
            'audio/webm' => 'opus',
            'audio/mpeg' => 'mp3',
            default => 'dat'
        };
        // Generate secure filename
        $timestamp = date('Ymd_His');
        $filename = 'audio_' . $timestamp . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $filepath = $uploadDir . '/' . $filename;
        // Copy file
        if (!copy($file['tmp_name'], $filepath)) {
            http_response_code(500);
            throw new Exception('Failed to save file');
        }
    } // $log

    $dbgpost=(int)($_POST['dbgpost'] ?? 0);
    if ($dbgpost>0) {
        // Nur speichern
        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'File uploaded for debugging', 'filename'=>$filename], JSON_UNESCAPED_SLASHES);
        exit;
    }

    // STT via OpenAI API
    $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
    $postFields = [
        'model' => 'gpt-4o-mini-transcribe',  // leichtgewichtig- Mini-Variante ist die fixeste
        'language' => 'de',                   // Deutsch erzwingen
        // optional: 'temperature' => '0',
        'file' => new CURLFile($file['tmp_name'], $file['type'], $file['name']),
    ];

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => $postFields,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($response === false) {
        throw new Exception('cURL error: ' . curl_error($ch));
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        throw new Exception("cURL HTTP $httpCode: $response");
    }

    if ($log > 1) { // Dateinamen mit Response verknuepfen
        file_put_contents($uploadDir . '/stt_' . $filename . '.json', $response);
    }

    $data = json_decode($response, true);

    // Bei gpt-4o(-mini)-transcribe kommt standardmäßig JSON; der Text steckt i.d.R. in "text".
    $stt =  $data['text'] ?? $response;

    // Success response
    http_response_code(201);
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
}
