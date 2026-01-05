<?php

/**
 * login.php - (C) JoEmbedded - 04.01.2026
 * Get sessionID and user settings
 * Receives data via GET/POST Reply as JSON
 * Login startet ggfs. eine neue session und hinterlegt dafür eine sessionId
 * im Verzeichnis des TESTUSERs (verzeichnis mus credentials müssen vorhanden sein).
 * Die Daten sind als PHP hinterlegt, damit sicher nicht scanbar.
 *
 * Login:    http://localhost/wrk/ai/playground/sw/api/login.php?user=TESTUSER&password=12345678 
 * Re-Login: http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logrem&user=TESTUSER
 * Logout:  http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logout
 */

declare(strict_types=1);

// Configuration
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
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'Lax',
            'use_strict_mode' => true
        ]);
    }
    
    $sessionId = $_REQUEST['sessionId'] ?? '';

    // Validate and sanitize user
    $user = $_REQUEST['user'] ?? '';
    if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $user)) {
        http_response_code(400);
        throw new Exception('Invalid user format');
    }
    $userDir = $dataDir . '/' . $user;
    $xlog .= " User:'$user'";

    $credentialsFile = $userDir . '/credentials.json.php';

    $cmd = $_REQUEST['cmd'] ?? '';
    if ($cmd === 'logout') { // Zum Abmelden keine weiteren Parm. nötig
        $response = ['success' => true];
        if (!empty($sessionId) && isset($_SESSION['user'])) { // Maximal die eigene zersterobar
            $user = $_SESSION['user'];
            $accessFile = $userDir . '/access.json.php';
            if (file_exists($accessFile)) {
                unlink($accessFile);
            }
            $xlog .= " logout";
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();
    } else {

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

        if ($cmd === 'logrem') {
            $sessionId = $_SESSION['sessionId'] ?? '';
            if (empty($sessionId)) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }
            
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
        } else { // regular login

            // Validate password
            $password = $_REQUEST['password'] ?? '';
            if (strlen($password) < MIN_PASSWORD_LENGTH || strlen($password) > MAX_PASSWORD_LENGTH) {
                http_response_code(401);
                throw new Exception('Access denied'); // Nix preisgeben!
            }

            // Verify password (use password_verify for hashed passwords in production)
            $storedPassword = $credentials['password'] ?? '';
            if (empty($storedPassword)) {
                http_response_code(401);
                throw new Exception('Access denied');
            }
            
            // Plain text comparison (consider using password_verify($password, $storedPassword) for hashed passwords)
            if ($storedPassword !== $password) {
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
                json_encode($accessData, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
            ) === false) {
                http_response_code(500);
                throw new Exception('Failed to save session');
            }

            $xlog .= " login SessionId:'$sessionId'";

            session_regenerate_id(true);
            $_SESSION['user'] = $user;
            $_SESSION['sessionId'] = $sessionId;
            $_SESSION['login_time'] = time();
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
        
        $hellos = json_decode($hellosContent, true);
        if (!is_array($hellos) || empty($hellos)) {
            http_response_code(500);
            throw new Exception("Invalid hellos file format");
        }

        $narrator = $credentials['narrator'] ?? 'narrator_f_jane';
        $response = [
            'success' => true,
            'user' => $user,
            'sessionId' => $sessionId,
            'userLang' => $userLang,
            'helpTexts' => $hellos,
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
