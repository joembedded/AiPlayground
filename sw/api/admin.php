<?php

/**
 * admin.php - (C) JoEmbedded - 11.01.2026
 * Benutzer muss eingeloggt sein!
 
 * aauser-List:
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=userlist&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9

 * personas
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=personalist&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9
 * 
 *
 * credentials, credit, etc.. holen
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=getdata&mandant=vilo33&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9
 * Antworten im JSON-Format
 *
 * setpassword for user
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=setpassword&mandant=vilo33&newpassword=neuespasswort123&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9
 *
*
* generateuser
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=generateuser&mandant=_template_vilo&newuser=newuser123&newpassword=neuespasswort123&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9
 * credentials und credits muessen im admin/agent User hinterlegt sein
 * credits werden dem admin/agent abgezogen

* setdata for user (nur admin)
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=setdata&mandant=vilo33&credentials={...}&credits={...}&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9
 *
 * deleteuser (nur admin)
 * http://localhost/wrk/ai/playground/sw/api/admin.php?cmd=deleteuser&mandant=vilo33&user=admin_jo&sessionId=74884c7b0572d5aed170663cee71e1b9    
 *
 * Wichtig Die Dateianfänge '_' (z.B. Template) sind Systemordner und werden nicht angezeigt!
 * Die Dateianfange 'admin_' und 'agent_' sind fuer Admins bzw. Agenten reserviert
 */

declare(strict_types=1);

// Configuration
$log = 1; // 0: Silent, 1: Logfile schreiben
$xlog = "admin.php"; // .php damit klarer. Debug-Ausgaben sammeln
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

    // CMD immer und fix in Laenge
    $cmd = $_REQUEST['cmd'] ?? '';

    // User/admin/agent auch immer -  Validate and sanitize user
    $user = $_REQUEST['user'] ?? '';
    if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $user)) {
        http_response_code(400);
        throw new Exception('Invalid user format');
    }
    $xlog_back = $xlog;
    $xlog .= " User:'$user'";

    // Nun alle Dirs
    $userDir = $dataDir . '/' . $user;
    $accessFile = $userDir . '/access.json.php';

    // Check user directory (nicht anlegen!) und alle antworten identisch ***
    if (!is_dir($userDir)) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }

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

    // Credentials sind mmer notwendig
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
    $role = $credentials['role'] ?? '';
    // Nur admin und agent kommen hier weiter
    if (empty($role) || ($role !== 'admin' && $role !== 'agent')) {
        http_response_code(401);
        throw new Exception('Access denied'); // Nix preisgeben!
    }
    $xlog = "$xlog_back $role:'$user' cmd:'$cmd' ";

    // Resppnse Basics
    $response = [
        'success' => true,
    ];

    // Immer gut
    $mandant = $_REQUEST['mandant'] ?? '';
    if (!empty($mandant)) { // Wenn Mandant angegeb, muss er auch gueltig sein
        //sanitize mandant
        if (!preg_match('/^[a-zA-Z0-9_-]{0,' . MAX_USER_LENGTH . '}$/', $mandant)) {
            http_response_code(400);
            throw new Exception('Invalid mandant format');
        }
        $selUserDir = $dataDir . '/' . $mandant;
        $userCredentialsFile = $selUserDir . '/credentials.json.php';
        if (!is_dir($selUserDir) || !file_exists($userCredentialsFile)) {
            http_response_code(400);
            throw new Exception('Invalid user for credentials');
        }
        $userCredentialsContent = file_get_contents($userCredentialsFile);
        if ($userCredentialsContent === false) {
            http_response_code(400);
            throw new Exception('Could not read credentials');
        }
        $userCredentials = json_decode($userCredentialsContent, true);
        // Credentials nun da

        // Credits auch holen
        $userCreditsFile = $selUserDir . '/credits.json.php';
        if (!is_dir($selUserDir) || !file_exists($userCreditsFile)) {
            http_response_code(400);
            throw new Exception('Invalid user for credits');
        }
        $userCreditsContent = file_get_contents($userCreditsFile);
        if ($userCreditsContent === false) {
            http_response_code(400);
            throw new Exception('Could not read credits');
        }
        $userCredits = json_decode($userCreditsContent, true);
    }

    // Admin Commands. Admin und agenten finden sich auch selbst
    switch ($cmd) {
        case 'userlist': // List-of-users (agent/admin)
            $dirlist = [];
            $dirs = scandir($dataDir);
            foreach ($dirs as $dir) {
                if ($dir === '.' || $dir === '..' || $dir[0] === '_') {
                    continue;
                }
                if ($role !== 'admin' && strpos($dir, 'admin') === 0) {
                    continue;
                }
                if (is_dir($dataDir . '/' . $dir)) {
                    $dirlist[] = $dir;
                }
            }
            $response['users'] = $dirlist;
            break;

        case 'personalist': // List of narrators (agent/admin)
            $dirlist = [];
            $dirs = scandir($dataDir);
            foreach ($dirs as $dir) {
                if (strpos($dir, '_template_') !== 0)  continue; // Nur _template_* Ordner

                if (is_dir($dataDir . '/' . $dir)) {
                    $dirlist[] = substr($dir, strlen('_template_'));
                }
            }
            $response['persona'] = $dirlist;
            break;

        case 'setpassword': // Set password for user (agent/admin)
            if (empty($mandant)) throw new Exception('Mandant is required for setpassword');
            $newpassword = $_REQUEST['newpassword'] ?? '';
            if (!preg_match('/^.{' . MIN_PASSWORD_LENGTH . ',' . MAX_PASSWORD_LENGTH . '}$/', $newpassword)) {
                http_response_code(400);
                throw new Exception('Password must be ' . MIN_PASSWORD_LENGTH . '-' . MAX_PASSWORD_LENGTH . ' characters');
            }
            // Update password
            $userCredentials['passwordhash'] = password_hash($newpassword, PASSWORD_DEFAULT);
            file_put_contents($userCredentialsFile, json_encode($userCredentials, JSON_PRETTY_PRINT));
            $response['message'] = "Password updated for user '$mandant' to '$newpassword'";
            $xlog .= " SetPassword_for_user:'$mandant'";
            break;

        case 'deleteuser': // Delete user (admin only)
            if ($role !== 'admin') throw new Exception('Only admin can use deleteuser');
            if (empty($mandant)) throw new Exception('Mandant is required for deleteuser');

            $selUserDir = $dataDir . '/' . $mandant;
            if (!is_dir($selUserDir)) {
                http_response_code(400);
                throw new Exception('Invalid user for deletion');
            }
            // Recursively delete user directory
            function rrmdir($dir)
            {
                if (is_dir($dir)) {
                    $objects = scandir($dir);
                    foreach ($objects as $object) {
                        if ($object != "." && $object != "..") {
                            if (is_dir($dir . "/" . $object) && !is_link($dir . "/" . $object))
                                rrmdir($dir . "/" . $object);
                            else
                                unlink($dir . "/" . $object);
                        }
                    }
                    rmdir($dir);
                }
            }
            rrmdir($selUserDir);
            $response['message'] = "User '$mandant' deleted successfully";
            $xlog .= " Deleted_user:'$mandant'";
            break;

        case 'getdata': // Get credentials (agent/admin)
            if (empty($mandant)) throw new Exception('Mandant is required for getdata');
            $response['credentials'] = $userCredentials;
            $response['credits'] =  $userCredits;
            break;

        case 'setdata': // Set credentials (Darf nur der Admin, da JSON ändern riskant ist)
            if ($role !== 'admin') throw new Exception('Only admin can use setdata');
            if (empty($mandant)) throw new Exception('Mandant is required for setdata');
            $newUserCredentials = json_decode($_REQUEST['credentials'] ?? '', true);


            if (!is_array($newUserCredentials) || empty($newUserCredentials)) {
                throw new Exception('Invalid credentials format');
            }
            $newUserCredits = json_decode($_REQUEST['credits'] ?? '', true);
            if (empty($newUserCredits) || !is_array($newUserCredits)) {
                throw new Exception('Invalid credits format');
            }
            file_put_contents($userCredentialsFile, json_encode($newUserCredentials, JSON_PRETTY_PRINT));
            file_put_contents($userCreditsFile, json_encode($newUserCredits, JSON_PRETTY_PRINT));
            $response['credentials'] = $newUserCredentials;
            $response['credits'] =  $newUserCredits;
            $response['message'] = "Data updated for user '$mandant'";
            break;

        case 'generateuser': // Darf jeder admin/agent
            if (empty($mandant)) throw new Exception('Mandant is required for generateuser');

            $callerCreditsFile = $dataDir . '/' . $user . '/credits.json.php';
            $callerCreditsContent = file_get_contents($callerCreditsFile);
            $callerCredits = json_decode($callerCreditsContent, true);
            if ($callerCredits === null || !is_array($callerCredits))  throw new Exception('Could not read caller credits');
            $callerCreditsAvailable = $callerCredits['chat'] ?? 0; // Wieviel Credits der Caller hat
            // Requested Modell hat 2 Parameter: NAME und PW. Die Default-Credits müssen reichen, da die dem admin/agent abgezogen werden
            // Das Neue Modell wurde per Mandant geladen
            $requiredCredits = $userCredits['chat'] ?? 0; // Wieviel Credits der neue User haben soll    
            if ($callerCreditsAvailable < $requiredCredits) { // Minimum  Credits
                throw new Exception('Not enough credits to create new user. Available: ' . $callerCreditsAvailable . ', required: ' . $requiredCredits);
            }

            $newuser = $_REQUEST['newuser'] ?? '';
            if (!preg_match('/^[a-zA-Z0-9_-]{' . MIN_USER_LENGTH . ',' . MAX_USER_LENGTH . '}$/', $newuser)) {
                throw new Exception('Invalid new user format');
            }
            $newpassword = $_REQUEST['newpassword'] ?? '';
            if (!preg_match('/^.{' . MIN_PASSWORD_LENGTH . ',' . MAX_PASSWORD_LENGTH . '}$/', $newpassword)) {
                throw new Exception('Password must be ' . MIN_PASSWORD_LENGTH . '-' . MAX_PASSWORD_LENGTH . ' characters');
            }
            $newuserDir = $dataDir . '/' . $newuser;
            $newuserCredentialsFile = $newuserDir . '/credentials.json.php';
            $newuserCreditsFile = $newuserDir . '/credits.json.php';
            if (is_dir($newuserDir)) {                
                throw new Exception("User '$newuser' already exists");
            }
            mkdir($newuserDir, 0755, true);
            // Default credentials

            // Update password
            $userCredentials['passwordhash'] = password_hash($newpassword, PASSWORD_DEFAULT);
            file_put_contents($newuserCredentialsFile, json_encode($userCredentials, JSON_PRETTY_PRINT));
            file_put_contents($newuserCreditsFile, json_encode($userCredits, JSON_PRETTY_PRINT));

            // OK Credits haben gereicht
            $callerCredits['chat'] -= $requiredCredits;
            file_put_contents($callerCreditsFile, json_encode($callerCredits, JSON_PRETTY_PRINT));

            $response['message'] = "User '$newuser' / '$newpassword' created from template '$mandant', credits left: " . $callerCredits['chat'];
            $xlog .= "User '$newuser' created from template '$mandant', credits left: " . $callerCredits['chat'];

            break;

        default:
            http_response_code(400);
            throw new Exception("Invalid command '$cmd'");
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
