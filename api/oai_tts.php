<?php
/* 
* oai_tts.php - Text-to-Speech mit OpenAI API 
* http://localhost/wrk/ai/playground/api/oai_tts.php 
* optional 'text'=  Vorlese-Text Opt. in "" 
* optional 'voice'= Stimme (Dateiname ohne "" und ohne .json im /voices Verzeichnis)
* optional Parameter 'stream' aktiviert streaming. Ohne 'stream' aber etwas bessere Qualität.
*/

declare(strict_types=1);
$log = 2; // 0: Silent, 1(min.Empfehlung): Log upload (audio .webm) 2: Log upload + response(.json) mit Tokens, resultm ...

// CORS and Content-Type headers
// header('Content-Type: application/json; charset=UTF-8'); // Header kommt spaeter
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
$speechDir = __DIR__ . '/../audio/speech'; // fuer logs, setup und audios
$voicesDir = __DIR__ . '/../voices'; // muss schon da seom
try {
    if (!$apiKey) {
        http_response_code(500);
        throw new Exception('OPENAI_API_KEY missing');
    }

    // Create speech directory - immer gur
    if (!is_dir($speechDir) && !mkdir($speechDir, 0755, true)) {
        http_response_code(500);
        throw new Exception('Failed to create speech directory');
    }

    // Vorlese-Text (z. B. aus POST/GET)
    $text = trim($_REQUEST['text'] ?? '', " \n\r\t\v\0\"");
    if (!$text) {
        http_response_code(400);
        throw new Exception('ERROR: Kein Text');
    }
    $stream = isset($_REQUEST['stream']) ?? false;
    $format = 'opus'; // 'mp3'; // Opus ist kleiner als MP3
    $audioContent = match ($format) {
        'mp3' => 'audio/mpeg',
        'opus' => 'audio/ogg; codecs=opus',
        default => 'application/octet-stream'
    };

    $voice = $_REQUEST['voice'] ?? '(unknown)';
    $hash = hash('md5', $text);
    $diskFname = $voice . '_' . $hash . '.' . $format;
    $diskPath = $speechDir . '/' . $diskFname;

    // Wenn schon da, aus CACHE nehmen
    if (file_exists($diskPath)) {
        $cachedAudio = file_get_contents($diskPath);
        touch($diskPath);
        header("Content-Type: $audioContent");
        header("Content-Length: " . strlen($cachedAudio));
        echo $cachedAudio;
        exit;
    }

    $voiceRaw = @file_get_contents($voicesDir . '/' . $voice . '.json');
    if (!$voiceRaw) {
        http_response_code(400);
        throw new Exception("ERROR: No Voice '$voice.json'");
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
    if ($log > 0) {
        // Logfile/Audio speichern
        file_put_contents($diskPath, $stream ? $audioStreamed : $audioBytes);
        if ($log > 1) {
            $logjson = ['text' => $text, 'voice' => $voice, 'date' => date('Y-m-d H:i:s')];
            file_put_contents($speechDir . '/' . $diskFname . '.json', json_encode($logjson, JSON_UNESCAPED_UNICODE));
        }
    }
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
