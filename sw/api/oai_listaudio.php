<?php

/**
 * oai_getaudio.php - (C) JoEmbedded - 31.12.2025
 * Param: dir=<verzeichnis>
 * http://localhost/wrk/ai/playground/sw/api/oai_listaudio.php?dir=audio/uploads
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
$directory = $_REQUEST['dir'] ?? '';

// Load API keys
include_once __DIR__ . '/../secret/keys.inc.php';

// Validate API password
if (($_REQUEST['apipw'] ?? '') !== API_PASSWORD) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorised']);
    exit;
}

// Basis-Pfad normalisieren
$basePath = realpath(dirname(__DIR__) . '/../' . USERDIR);
if ($basePath === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Basis-Verzeichnis nicht gefunden']);
    exit;
}

// Ziel-Pfad normalisieren
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
    // '.' und '..' überspringen
    if ($file === '.' || $file === '..') {
        continue;
    }

    $filePath = $fullPath . DIRECTORY_SEPARATOR . $file;

    // Verzeichnisse hinzufügen
    if (is_dir($filePath)) {
        $audioFiles[] = [
            'type' => 'directory',
            'name' => $file,
            'modified' => date('Y-m-d H:i:s', filemtime($filePath))
        ];
        continue;
    }

    // Nur .ogg, .opus und .mp3 Dateien
    if (!is_file($filePath)) {
        continue;
    }

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($extension, ['ogg', 'opus', 'mp3'])) {
        continue;
    }

    // Datei-Informationen sammeln
    $audioFiles[] = [
        'type' => 'file',
        'name' => $file,
        'size' => filesize($filePath),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath))
    ];
}

// Sortieren: Verzeichnisse zuerst, dann nach Namen
usort($audioFiles, function ($a, $b) {
    // Verzeichnisse vor Dateien
    if ($a['type'] !== $b['type']) {
        return $a['type'] === 'directory' ? -1 : 1;
    }
    // Innerhalb des gleichen Typs alphabetisch
    return strcmp($a['name'], $b['name']);
});

// JSON-Response
echo json_encode([
    'directory' => $directory,
    'count' => count($audioFiles),
    'files' => $audioFiles
], JSON_PRETTY_PRINT);
