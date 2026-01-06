<?php

/**
 * login.php - (C) JoEmbedded - 05.01.2026
 * 
 * Login startet ggfs. eine neue Session und hinterlegt dafür eine sessionId
 * im Verzeichnis des Users (Verzeichnis muss credentials enthalten).
 * Die Daten sind als PHP und hashed hinterlegt, damit sicher nicht scanbar.
 * (Hash erstellen mit password_hash('Passwort', PASSWORD_DEFAULT), siehe Code unten).
 *
 * Login:    http://localhost/wrk/ai/playground/sw/api/login.php?cmd=login&user=TESTUSER&password=12345678 
 * Re-Login: http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logrem
 * Logout:  http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logout
 */

declare(strict_types=1);

// Configuration
$log = 1; // 0: Silent, 1: Logfile schreiben 2: Log complete Reply(***DEV***)
$xlog = "login"; // Debug-Ausgaben sammeln
include_once __DIR__ . '/../php_tools/logfile.php';

// CORS headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Load API keys
include_once __DIR__ . '/../secret/keys.inc.php';

// Constants
define('MIN_USER_LENGTH', 6);
define('MAX_USER_LENGTH', 32);
define('MIN_PASSWORD_LENGTH', 8);
define('MAX_PASSWORD_LENGTH', 32);
define('SESSION_ID_BYTES', 16);

$dataDir = __DIR__ . '/../../' . USERDIR . '/users';
try {
    // Session-Sicherheit
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $sessionId = $_SESSION['sessionId'] ?? '';

    if ($log > 1) { // ***DEV***
        $xlog .= " ***DEV*** sessionID:" . $sessionId ?? '';
        $xlog .= " cmd:'" . ($_REQUEST['cmd'] ?? '') . "'";
        $xlog .= " user:'" . ($_REQUEST['user'] ?? '') . "'";
        $xlog .= " password:'" . ($_REQUEST['password'] ?? '') . "'";
    }

    $cmd = $_REQUEST['cmd'] ?? '';
    if ($cmd === 'logout') { // Zum Abmelden keine weiteren Parm. nötig
        $response = ['success' => true];
        if (!empty($sessionId) && !empty($_SESSION['user'])) { // Maximal die eigene zersterobar
            $user = $_SESSION['user'];
            $userDir = $dataDir . '/' . $user;
            $accessFile = $userDir . '/access.json.php';
            if (file_exists($accessFile)) {
                unlink($accessFile);
            }
            $xlog .= " logout";
        }
        $_SESSION = [];
        session_destroy();
    } else {
        if ($cmd === 'logrem') {
            $sessionId = $_SESSION['sessionId'] ?? '';
            if (empty($sessionId)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }
            $user = $_SESSION['user'] ?? '';
            if (empty($user)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }
            $userDir = $dataDir . '/' . $user;

            // Verify session file matches
            $accessFile = $userDir . '/access.json.php';
            if (file_exists($accessFile)) {
                $accessData = json_decode(file_get_contents($accessFile), true);
                if (($accessData['sessionId'] ?? '') !== $sessionId) {
                    http_response_code(401);
                    throw new Exception('Access denied');
                }
            } else {
                http_response_code(401);
                throw new Exception('Access denied');
            }
            $xlog .= " login(remembered)";
        } else if ($cmd === 'login') { // regular login
            // Validate and sanitize user
            $user = $_REQUEST['user'] ?? '';
            if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $user)) {
                http_response_code(400);
                throw new Exception('Invalid user format');
            }
            $userDir = $dataDir . '/' . $user;
            $xlog .= " User:'$user'";

            $credentialsFile = $userDir . '/credentials.json.php';

            // Check user directory (nicht anlegen!) und alle antworten identisch ***
            if (!is_dir($userDir)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }
            if (!file_exists($credentialsFile)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }

            $credentialsContent = file_get_contents($credentialsFile);
            if ($credentialsContent === false) {
                http_response_code(401);
                throw new Exception('Access denied');
            }

            $credentials = json_decode($credentialsContent, true);
            if (!is_array($credentials) || empty($credentials)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }

            // Validate password
            $userEnteredPassword = $_REQUEST['password'] ?? '';
            if (strlen($userEnteredPassword) < MIN_PASSWORD_LENGTH || strlen($userEnteredPassword) > MAX_PASSWORD_LENGTH) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }

            // Verify password with password_verify
            $storedPasswordHash = $credentials['passwordhash'] ?? '';
            if (empty($storedPasswordHash)) {
                http_response_code(401);
                throw new Exception('Access denied');
            }

            // Verify hashed password
            //echo password_hash($userEnteredPassword, PASSWORD_DEFAULT); exit; // Gen. TestHash
            if (!password_verify($userEnteredPassword, $storedPasswordHash)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }

            $sessionId = bin2hex(random_bytes(SESSION_ID_BYTES)); // 32 Zeichen Session-ID

            // Save credentials and access time
            $accessData = [
                'date' => date('Y-m-d H:i:s'),
                'sessionId' => $sessionId,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ];

            if (file_put_contents(
                $userDir . '/access.json.php',
                json_encode($accessData, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
                LOCK_EX
            ) === false) {
                http_response_code(500);
                throw new Exception('Failed to save session');
            }

            $xlog .= " login SessionId:'$sessionId'";

            session_regenerate_id(true);
            $_SESSION['user'] = $user;
            $_SESSION['sessionId'] = $sessionId;
            $_SESSION['login_time'] = time();
        } else {
            http_response_code(400);
            throw new Exception('Invalid command');
        }

        $personaDir = __DIR__ . '/../persona';
        $userLang = $credentials['userLang'] ?? 'de-DE';
        // Sanitize language code (e.g., de-DE, en-US)
        $userLangPrefix = preg_replace('/[^a-zA-Z_]/', '_', $userLang);
        $hellosFile = $personaDir . '/' . $userLangPrefix . '_hello.json';

        if (!file_exists($hellosFile)) {
            http_response_code(500);
            throw new Exception("Missing hellos file for language: $userLang");
        }

        $hellosContent = file_get_contents($hellosFile);
        if ($hellosContent === false) {
            http_response_code(500);
            throw new Exception("Failed to read hellos file");
        }

        $helloAll = json_decode($hellosContent, true);
        if (empty($helloAll) || !is_array(@$helloAll['helpTxts'])) {
            http_response_code(500);
            throw new Exception("Invalid hellos file format");
        }

        $narrator = $credentials['narrator'] ?? 'narrator_f_jane';
        $response = [
            'success' => true,
            'user' => $user,
            'sessionId' => $sessionId,
            'userLang' => $userLang,
            'helpTexts' => $helloAll['helpTxts'] ,
            'speakVoice' => $narrator,
        ];
    }

    http_response_code(200); // Success (201 ist für Resource Creation)
    echo json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Error handling
    $currentCode = http_response_code();
    if ($currentCode === 200 || $currentCode === false) {
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $xlog = "ERROR:'" . $e->getMessage() . "' " . $xlog;
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $xlog = "IP:$ip " . $xlog;
} finally {
    log2file($xlog);
}
