<?php

/**
 * oai_getaudio.php - (C) JoEmbedded - 29.12.2025
 * Param: dir=<verzeichnis>
 * http://localhost/wrk/ai/playground/api/oai_listaudio.php?dir=audio/uploads
 */

declare(strict_types=1);

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

// Parameter holen
$directory = $_GET['dir'] ?? $_POST['dir'] ?? '';

// Sicherheitscheck: Verzeichnis validieren
if (empty($directory)) {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter "dir" ist erforderlich']);
    exit;
}

// Basis-Pfad (anpassen an dein Setup)
$basePath = dirname(__DIR__);
$fullPath = realpath($basePath . '/' . $directory);

// Sicherheitscheck: Pfad muss innerhalb des Basis-Verzeichnisses liegen
if ($fullPath === false || strpos($fullPath, $basePath) !== 0) {
    http_response_code(403);
    echo json_encode(['error' => 'Ungültiges Verzeichnis']);
    exit;
}

// Verzeichnis existiert?
if (!is_dir($fullPath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Verzeichnis nicht gefunden']);
    exit;
}

// Dateien scannen
$audioFiles = [];
$files = scandir($fullPath);

foreach ($files as $file) {
    $filePath = $fullPath . DIRECTORY_SEPARATOR . $file;
    
    // Nur .opus und .mp3 Dateien
    if (!is_file($filePath)) {
        continue;
    }
    
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($extension, ['opus', 'mp3'])) {
        continue;
    }
    
    // Datei-Informationen sammeln
    $fileInfo = [
        'filename' => $file,
        // 'path' => $directory . '/' . $file,
        'size' => filesize($filePath),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath) )
    ];
    
    $audioFiles[] = $fileInfo;
}

// Sortieren nach Dateinamen
usort($audioFiles, function($a, $b) {
    return strcmp($a['filename'], $b['filename']);
});

// JSON-Response
echo json_encode([
    'directory' => $directory,
    'count' => count($audioFiles),
    'files' => $audioFiles
], JSON_PRETTY_PRINT);

