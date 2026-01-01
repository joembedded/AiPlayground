<?php

/**
 * oai_tts.php - Text-to-Speech mit OpenAI API - (C) JoEmbedded - 01.01.2026
 * Parameter:
 *   text   - Vorlese-Text
 *   voice  - Stimme (Dateiname ohne .json aus /voices)
 *   stream - Optional: aktiviert Streaming (etwas geringere Qualität)
 *  http://localhost/wrk/ai/playground/sw/api/oai_tts.php?apipw=Leg1310LX&text=Hallo%20Welt&voice=narrator_m_vilo
 */

declare(strict_types=1);

// Configuration - Loglevel
$log = 1; // 0: Silent, 1: Logfile schreiben
$xlog = "oai_tts"; // Debug-Ausgaben sammeln
include_once __DIR__ . '/../php_tools/logfile.php';

$cache = true; // Cache fuer audiofiles aktivieren
$format = 'opus'; // opus oder mp3 / Ogg kennt er nicht
// CORS headers
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
$speechDir = __DIR__ . '/../../' . USERDIR . '/audio/speech';
$voicesDir = __DIR__ . '/../voices';

try {
    // Validate API password
    if (($_REQUEST['apipw'] ?? '') !== API_PASSWORD) {
        http_response_code(401);
        throw new Exception('Not authorized');
    }

    if (!$apiKey) {
        http_response_code(500);
        throw new Exception('OPENAI_API_KEY missing');
    }

    // Vorlese-Text (z. B. aus POST/GET)
    $text = trim(str_replace(["\r\n", "\n", "\r"], ' ', $_REQUEST['text'] ?? ''), " \n\r\t\v\0\"");
    if (!$text) {
        http_response_code(400);
        throw new Exception('ERROR: Kein Text');
    }
    $stream = isset($_REQUEST['stream']) ?? false;

    $audioContent = match ($format) {
        'mp3' => 'audio/mpeg',
        'opus' => 'audio/webm; codecs=opus',
        'ogg' => 'audio/ogg; codecs=opus',
        default => 'application/octet-stream'
    };
    // Validate and sanitize voice
    $voice = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['voice'] ?? 'unknown');
    if (strlen($voice) < 1 || strlen($voice) > 32) {
        http_response_code(400);
        throw new Exception('Voice must be 1-32 characters');
    }

    $voiceRaw = @file_get_contents($voicesDir . '/' . $voice . '.json');
    if (!$voiceRaw) {
        http_response_code(400);
        throw new Exception("ERROR: No Voice '$voice.json'");
    }

    $hash = hash('md5', $text);
    $diskFname = $hash . '.' . $format;
    $diskPath = $speechDir . '/' . $voice . '/';

    // Create upload directory for voice
    if (!is_dir($diskPath) && !mkdir($diskPath, 0755, true)) {
        http_response_code(500);
        throw new Exception('Failed to create upload directory');
    }
    $diskPath .= $diskFname;
    $slen = strlen($text);
    $xlog .= " Voice:$voice Text[$slen]:'" . (substr($text, 0, 120)) . ($slen > 120 ? "...'" : "'");

    // Wenn schon da, aus CACHE nehmen
    if (file_exists($diskPath)) {
        $cachedAudio = file_get_contents($diskPath);
        @touch($diskPath);
        header("Content-Type: $audioContent");
        header("Content-Length: " . strlen($cachedAudio));
        echo $cachedAudio;
        $xlog .= " File[" . strlen($cachedAudio) . "]:$diskFname (Cached)";
        log2file($xlog);
        exit;
    }

    $payload = @json_decode($voiceRaw, true);
    if (!$payload) {
        http_response_code(400);
        throw new Exception("ERROR: Voice '$voice.json' invalide JSON");
    }
    // Userdaten dazu
    $payload['input'] = $text;
    $payload['response_format'] = $format;



    $ch = curl_init("https://api.openai.com/v1/audio/speech");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $apiKey",
            "Content-Type: application/json"
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 60
    ]);

    $audioStreamed = "";
    if ($stream) {
        // Das ist der entscheidende Teil für Streaming:
        // Wir schreiben die Antwort direkt in den PHP-Ausgabepuffer
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $data) use (&$audioStreamed) {
            echo $data;
            flush(); // Schickt die Daten sofort zum Browser
            $audioStreamed .= $data;
            return strlen($data);
        });
        // Und Header vor cURL
        header("Content-Type: $audioContent");
        header('Cache-Control: no-cache');
    }

    $audioBytes = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);

    if (!$stream) {
        // Nur wenn nicht gestreamt wird
        if ($audioBytes === false || $http < 200 || $http >= 300) {
            http_response_code(502);
            throw new Exception($err ?: "TTS fehlgeschlagen (HTTP: $http)");
        }

        // MP3/OPUS an den Browser ausliefern
        header("Content-Type: $audioContent");
        header("Content-Length: " . strlen($audioBytes));
        echo $audioBytes;
    }

    // Aufschreiben, entweder gestreamt oder normal
    if ($cache)      file_put_contents($diskPath, $stream ? $audioStreamed : $audioBytes);
    $xlog .= " File[" . strlen($stream ? $audioStreamed : $audioBytes) . "]:$diskFname " . ($stream ? "(Stream-CREATED)" : "(CREATED)");

} catch (Exception $e) {
    header('Content-Type: application/json; charset=UTF-8');
    if (http_response_code() === 200) {
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES);
    $xlog = "ERROR:'" . $e->getMessage()."' " . $xlog;
    $ip=$_SERVER['REMOTE_ADDR'];
    if(isset($ip))  $xlog = "IP:$ip ".$xlog;     
}
log2file($xlog);
