<?php

/**
 * login.php - (C) JoEmbedded - 11.01.2026
 * 
 * Im Verzeichnis des Users (Verzeichnis muss credentials enthalten).
 * Die Daten sind als PHP und hashed hinterlegt, damit sicher nicht scanbar.
 * (Hash erstellen mit password_hash('Passwort', PASSWORD_DEFAULT), siehe Code unten).
 * Idee: Echter Login mit User/Passwort, dann wird eine (temporaere) SessionId erstellt,
 * die dann auf dem Client gespeichert wird und bei jedem weiteren Request mitgeschickt wird.
 * logrem (re-login) prueft nur die SessionId.
 * 
 * Gut testbar mit dem Tool loginmonitor.html 
 *
 * Login:    http://localhost/wrk/ai/playground/sw/api/login.php?cmd=login&user=TESTUSER&password=12345678 
 * Re-Login: http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logrem&user=TESTUSER&sessionId=SESSIONID
 * Logout:  http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logout&user=TESTUSER&sessionId=SESSIONID
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

    if ($log > 1) { // ***DEV***
        $xlog .= " (***DEV*** sessionid:" . ($_REQUEST['sessionId'] ?? '');
        $xlog .= " command:'" . ($_REQUEST['cmd'] ?? '') . "'";
        $xlog .= " username:'" . ($_REQUEST['user'] ?? '') . "'";
        $xlog .= " password:'" . ($_REQUEST['password'] ?? '') . "' ***DEV***)";
    }

    // CMD immer
    $cmd = $_REQUEST['cmd'] ?? '';

    // User auch immer -  Validate and sanitize user
    $user = $_REQUEST['user'] ?? '';
    if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $user)) {
        http_response_code(400);
        throw new Exception('Invalid user format');
    }
    $xlog .= " User:'$user'";

    // Nun alle Dirs
    $userDir = $dataDir . '/' . $user;
    $accessFile = $userDir . '/access.json.php';

    // Check user directory (nicht anlegen!) und alle antworten identisch ***
    if (!is_dir($userDir)) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }

    // Initialize variables
    $credentials = [];
    $sessionId = '';

    // AB jetzt die eigentlichen Kommandos
    if ($cmd === 'login') { // regular login
        $credentialsFile = $userDir . '/credentials.json.php';

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
            'sessionId' => $sessionId
            // Weitere Daten koennen hier gespeichert werden
        ];

        if (file_put_contents(
            $accessFile,
            json_encode($accessData, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        ) === false) {
            http_response_code(500);
            throw new Exception('Failed to save session');
        }

        $xlog .= " login SessionId:'$sessionId'";
    } else {
        // Fuer logrem und logout wird die SessionId gebraucht
        $sessionId = $_REQUEST['sessionId'] ?? '';

        $access = null;
        if (strlen($sessionId) === 32 && file_exists($accessFile)) {
            $accessContent = file_get_contents($accessFile);
            if ($accessContent !== false) {
                $access = json_decode($accessContent, true);
            }
        }

        if (empty($access) || !isset($access['sessionId']) || $access['sessionId'] !== $sessionId) {
            http_response_code(401);
            throw new Exception('Access denied'); // Nix preisgeben!
        }

        if ($cmd === 'logrem') {            // Load credentials for user preferences
            $credentialsFile = $userDir . '/credentials.json.php';
            if (file_exists($credentialsFile)) {
                $credentialsContent = file_get_contents($credentialsFile);
                if ($credentialsContent !== false) {
                    $credentials = json_decode($credentialsContent, true);
                }
            }
            if (empty($credentials)) {
                $credentials = [];
            }
            $xlog .= " login(remembered)";
        } else if ($cmd === 'logout') {
            // Delete session file
            if (file_exists($accessFile)) {
                unlink($accessFile);
            }
            $xlog .= " logout";
            http_response_code(200); // Success (201 ist für Resource Creation)
            echo json_encode(
                ['success' => true],
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            );
            exit;
        } else {
            http_response_code(400);
            throw new Exception('Invalid command');
        }
    }

    // Guthaben prüfen 
    $creditsFile = $userDir . '/credits.json.php';
    $creditsAvailable = 0;
    if (file_exists($creditsFile)) {
        $credits = json_decode(file_get_contents($creditsFile), true);
        $creditsAvailable = (int)($credits['chat'] ?? 0);
    }

    // Resppnse Basics
    $response = [
        'success' => true,
        'user' => $user,
        'sessionId' => $sessionId,
        'creditsAvailable' => $creditsAvailable
    ];

    $role = $credentials['role'] ?? 'user';
    switch ($role) {
        case 'user':    // Default (ohne Role ist der USER)
            // =========== Role USER START ===========
            $personaDir = __DIR__ . '/../persona';
            $userLang = $credentials['userLang'] ?? 'de_DE';
            // Sanitize language code (e.g., de-DE -> de_DE, en-US -> en_US)
            $userLangSanitized = preg_replace('/[^a-zA-Z0-9]/', '_', $userLang);

            $narrator = $credentials['narrator'] ?? 'narrator_f_jane';
            $hellosFile = $personaDir . '/' . $narrator . '_hello_' . $userLangSanitized . '.json';

            if (!file_exists($hellosFile)) {
                http_response_code(500);
                throw new Exception("Missing hellos file '$hellosFile'");
            }

            $hellosContent = file_get_contents($hellosFile);
            if ($hellosContent === false) {
                http_response_code(500);
                throw new Exception("Failed to read hellos file");
            }

            $helloAll = json_decode($hellosContent, true);
            $helloTxts = $helloAll['hello'] ?? [];

            // Opt. DEBUG + Exit - drin lassen, da ggf. nuetzlich
            //echo json_encode($helloTxts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); exit;

            if (!is_array($helloTxts) || !isset($helloTxts['helpTxts']) || !is_array($helloTxts['helpTxts'])) {
                http_response_code(500);
                throw new Exception("Invalid hellos file format");
            }

            $response['userLang'] = $userLang;
            $response['helpTexts'] = $helloTxts['helpTxts'];
            $response['speakVoice'] = $narrator;
            $response['persona'] = $credentials['persona'] ?? '(not set)';
            $response['intro'] = $helloTxts['intro'] ?? '(Hallo)';
            // =========== Role USER ENDE ===========
            break;
        case 'admin':
            // =========== Role admin(darf ALLES) START ===========
            $response['role'] = 'admin';

            // =========== Role admin ENDE ===========
            break;
        case 'agent':
            // =========== Role agent(darf User verwalten) START ===========
            $response['role'] = 'agent';

            // =========== Role agent ENDE ===========
            break;

        default:
            // =========== Role Unbekannt ===========
            http_response_code(500);
            throw new Exception('Invalid user role');
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
