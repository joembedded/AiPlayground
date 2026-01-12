<?php
/**
 * admin.php - (C) JoEmbedded - 11.01.2026
 * Benutzerverwaltung für Admin- und Agent-Benutzer
 * 
 * Verfügbare Commands:
 * - userlist: Liste aller Benutzer
 * - personalist: Liste aller verfügbaren Persona-Templates
 * - getdata: Credentials und Credits eines Benutzers abrufen
 * - setpassword: Passwort eines Benutzers ändern (admin/agent)
 * - setdata: Credentials und Credits setzen (nur admin)
 * - generateuser: Neuen Benutzer erstellen (admin/agent)
 * - deleteuser: Benutzer löschen (nur admin)
 * 
 * Hinweise:
 * - Ordner mit '_' am Anfang sind Systemordner (z.B. _template_*)
 * - 'admin_' und 'agent_' Prefixe sind für Admins bzw. Agenten reserviert
 */

declare(strict_types=1);

// Configuration
$log = 1; // 0: Silent, 1: Logfile schreiben
$logMessage = 'admin.php';
include_once __DIR__ . '/../php_tools/logfile.php';

// CORS headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

$usersBaseDir = __DIR__ . '/../../' . USERDIR . '/users';

try {
    // Command validation
    $cmd = $_REQUEST['cmd'] ?? '';

    // Validate requesting user (admin/agent)
    $requestingUser = $_REQUEST['user'] ?? '';
    if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $requestingUser)) {
        http_response_code(400);
        throw new Exception('Invalid user format');
    }
    $logMessageBackup = $logMessage;
    $logMessage .= " User:'$requestingUser'";

    // User directories
    $requestingUserDir = $usersBaseDir . '/' . $requestingUser;
    $accessFile = $requestingUserDir . '/access.json.php';

    // Check user directory exists
    if (!is_dir($requestingUserDir)) {
        http_response_code(401);
        throw new Exception('Access denied');
    }

    // Validate session
    $sessionId = $_REQUEST['sessionId'] ?? '';

    $accessData = null;
    if (strlen($sessionId) === 32 && file_exists($accessFile)) {
        $accessContent = file_get_contents($accessFile);
        if ($accessContent !== false) {
            $accessData = json_decode($accessContent, true);
        }
    }

    if (empty($accessData) || !isset($accessData['sessionId']) || $accessData['sessionId'] !== $sessionId) {
        http_response_code(401);
        throw new Exception('Access denied');
    }

    // Load and validate credentials
    $requestingUserCredentialsFile = $requestingUserDir . '/credentials.json.php';
    if (!file_exists($requestingUserCredentialsFile)) {
        http_response_code(401);
        throw new Exception('Access denied');
    }
    $credentialsContent = file_get_contents($requestingUserCredentialsFile);
    if ($credentialsContent === false) {
        http_response_code(401);
        throw new Exception('Access denied');
    }
    $requestingUserCredentials = json_decode($credentialsContent, true);
    if (!is_array($requestingUserCredentials) || empty($requestingUserCredentials)) {
        http_response_code(401);
        throw new Exception('Access denied');
    }

    // Check role (only admin and agent allowed)
    $userRole = $requestingUserCredentials['role'] ?? '';
    if (empty($userRole) || ($userRole !== 'admin' && $userRole !== 'agent')) {
        http_response_code(401);
        throw new Exception('Access denied');
    }
    $logMessage = "$logMessageBackup $userRole:'$requestingUser' cmd:'$cmd' ";

    // Initialize response
    $response = ['success' => true];

    // Load target user (mandant) data if specified
    $targetUser = $_REQUEST['mandant'] ?? '';
    $targetUserCredentials = null;
    $targetUserCredits = null;

    if (!empty($targetUser)) {
        // Validate target user format
        if (!preg_match('/^[a-zA-Z0-9_-]{0,' . MAX_USER_LENGTH . '}$/', $targetUser)) {
            http_response_code(400);
            throw new Exception('Invalid mandant format');
        }

        $targetUserDir = $usersBaseDir . '/' . $targetUser;
        $targetUserCredentialsFile = $targetUserDir . '/credentials.json.php';
        $targetUserCreditsFile = $targetUserDir . '/credits.json.php';

        // Load credentials
        if (!is_dir($targetUserDir) || !file_exists($targetUserCredentialsFile)) {
            http_response_code(400);
            throw new Exception('Invalid user for credentials');
        }
        $credentialsContent = file_get_contents($targetUserCredentialsFile);
        if ($credentialsContent === false) {
            http_response_code(400);
            throw new Exception('Could not read credentials');
        }
        $targetUserCredentials = json_decode($credentialsContent, true);

        // Load credits
        if (!file_exists($targetUserCreditsFile)) {
            http_response_code(400);
            throw new Exception('Invalid user for credits');
        }
        $creditsContent = file_get_contents($targetUserCreditsFile);
        if ($creditsContent === false) {
            http_response_code(400);
            throw new Exception('Could not read credits');
        }
        $targetUserCredits = json_decode($creditsContent, true);
    }

    // Command handling
    switch ($cmd) {
        case 'userlist':
            $userList = [];
            $directories = scandir($usersBaseDir);
            foreach ($directories as $dir) {
                // Skip system directories and special entries
                if ($dir === '.' || $dir === '..' || $dir[0] === '_') {
                    continue;
                }
                // Agents cannot see admin users
                if ($userRole !== 'admin' && strpos($dir, 'admin') === 0) {
                    continue;
                }
                if (is_dir($usersBaseDir . '/' . $dir)) {
                    $userList[] = $dir;
                }
            }
            $response['users'] = $userList;
            break;

        case 'personalist':
            $personaList = [];
            $directories = scandir($usersBaseDir);
            foreach ($directories as $dir) {
                // Only process template directories
                if (strpos($dir, '_template_') === 0 && is_dir($usersBaseDir . '/' . $dir)) {
                    $personaList[] = substr($dir, strlen('_template_'));
                }
            }
            $response['persona'] = $personaList;
            break;

        case 'setpassword':
            if (empty($targetUser)) {
                throw new Exception('Mandant is required for setpassword');
            }
            $newPassword = $_REQUEST['newpassword'] ?? '';
            if (!preg_match('/^.{' . MIN_PASSWORD_LENGTH . ',' . MAX_PASSWORD_LENGTH . '}$/', $newPassword)) {
                http_response_code(400);
                throw new Exception('Password must be ' . MIN_PASSWORD_LENGTH . '-' . MAX_PASSWORD_LENGTH . ' characters');
            }
            // Update password
            $targetUserCredentials['passwordhash'] = password_hash($newPassword, PASSWORD_DEFAULT);
            file_put_contents($targetUserCredentialsFile, json_encode($targetUserCredentials, JSON_PRETTY_PRINT));
            $response['message'] = "Password updated for user '$targetUser'";
            $logMessage .= " SetPassword_for_user:'$targetUser'";
            break;

        case 'deleteuser':
            if ($userRole !== 'admin') {
                throw new Exception('Only admin can use deleteuser');
            }
            if (empty($targetUser)) {
                throw new Exception('Mandant is required for deleteuser');
            }

            $targetUserDir = $usersBaseDir . '/' . $targetUser;
            if (!is_dir($targetUserDir)) {
                http_response_code(400);
                throw new Exception('Invalid user for deletion');
            }

            // Recursively delete directory
            $deleteDirectory = function($dir) use (&$deleteDirectory) {
                if (is_dir($dir)) {
                    $objects = scandir($dir);
                    foreach ($objects as $object) {
                        if ($object !== '.' && $object !== '..') {
                            $path = $dir . '/' . $object;
                            if (is_dir($path) && !is_link($path)) {
                                $deleteDirectory($path);
                            } else {
                                unlink($path);
                            }
                        }
                    }
                    rmdir($dir);
                }
            };
            $deleteDirectory($targetUserDir);
            $response['message'] = "User '$targetUser' deleted successfully";
            $logMessage .= " Deleted_user:'$targetUser'";
            break;

        case 'getdata':
            if (empty($targetUser)) {
                throw new Exception('Mandant is required for getdata');
            }
            $response['credentials'] = $targetUserCredentials;
            $response['credits'] = $targetUserCredits;
            break;

        case 'setdata':
            if ($userRole !== 'admin') {
                throw new Exception('Only admin can use setdata');
            }
            if (empty($targetUser)) {
                throw new Exception('Mandant is required for setdata');
            }

            $newCredentials = json_decode($_REQUEST['credentials'] ?? '', true);
            if (!is_array($newCredentials) || empty($newCredentials)) {
                throw new Exception('Invalid credentials format');
            }

            $newCredits = json_decode($_REQUEST['credits'] ?? '', true);
            if (empty($newCredits) || !is_array($newCredits)) {
                throw new Exception('Invalid credits format');
            }

            file_put_contents($targetUserCredentialsFile, json_encode($newCredentials, JSON_PRETTY_PRINT));
            file_put_contents($targetUserCreditsFile, json_encode($newCredits, JSON_PRETTY_PRINT));
            $response['credentials'] = $newCredentials;
            $response['credits'] = $newCredits;
            $response['message'] = "Data updated for user '$targetUser'";
            break;

        case 'generateuser':
            if (empty($targetUser)) {
                throw new Exception('Mandant is required for generateuser');
            }

            // Load requesting user's credits
            $requestingUserCreditsFile = $requestingUserDir . '/credits.json.php';
            $requestingUserCreditsContent = file_get_contents($requestingUserCreditsFile);
            $requestingUserCredits = json_decode($requestingUserCreditsContent, true);
            if ($requestingUserCredits === null || !is_array($requestingUserCredits)) {
                throw new Exception('Could not read caller credits');
            }

            $availableCredits = $requestingUserCredits['chat'] ?? 0;
            $requiredCredits = $targetUserCredits['chat'] ?? 0;

            if ($availableCredits < $requiredCredits) {
                throw new Exception("Not enough credits. Available: $availableCredits, required: $requiredCredits");
            }

            // Validate new user parameters
            $newUsername = $_REQUEST['newuser'] ?? '';
            if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $newUsername)) {
                throw new Exception('Invalid new user format');
            }

            $newPassword = $_REQUEST['newpassword'] ?? '';
            if (!preg_match('/^.{' . MIN_PASSWORD_LENGTH . ',' . MAX_PASSWORD_LENGTH . '}$/', $newPassword)) {
                throw new Exception('Password must be ' . MIN_PASSWORD_LENGTH . '-' . MAX_PASSWORD_LENGTH . ' characters');
            }

            $newUserDir = $usersBaseDir . '/' . $newUsername;
            if (is_dir($newUserDir)) {
                throw new Exception("User '$newUsername' already exists");
            }

            // Create new user
            mkdir($newUserDir, 0755, true);
            $targetUserCredentials['passwordhash'] = password_hash($newPassword, PASSWORD_DEFAULT);
            file_put_contents($newUserDir . '/credentials.json.php', json_encode($targetUserCredentials, JSON_PRETTY_PRINT));
            file_put_contents($newUserDir . '/credits.json.php', json_encode($targetUserCredits, JSON_PRETTY_PRINT));

            // Deduct credits from requesting user
            $requestingUserCredits['chat'] -= $requiredCredits;
            file_put_contents($requestingUserCreditsFile, json_encode($requestingUserCredits, JSON_PRETTY_PRINT));

            $response['message'] = "User '$newUsername' created from template '$targetUser', credits left: " . $requestingUserCredits['chat'];
            $logMessage .= " User '$newUsername' created from template '$targetUser', credits left: " . $requestingUserCredits['chat'];

            break;

        default:
            http_response_code(400);
            throw new Exception("Invalid command '$cmd'");
    }

    http_response_code(200);
    echo json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    $currentCode = http_response_code();
    if ($currentCode === 200 || $currentCode === false) {
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $logMessage = "IP:$ip ERROR:'" . $e->getMessage() . "' " . $logMessage;

} finally {
    log2file($logMessage);
}
