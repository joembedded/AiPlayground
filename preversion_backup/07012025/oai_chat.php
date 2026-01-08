<?php

/*
* OpenAI Chat mit Persona
* http://localhost/wrk/ai/playground/sw/api/oai_chat.php?user=TESTUSER&sessionid=355c6639f2cfef7ab651286ef9a6d488&text=Wer_bist_Du

*/

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, (Empf:)1:Logfile schreiben 2: Log complete Reply
//$SIMULATION_FILE = "chat_20260106_005426.json"; // Wenn gesetzt: Datei statt OpenAI (***DEV***)
  
$xlog = "oai_chat"; // Debug-Ausgaben sammeln
include_once __DIR__ . '/../php_tools/logfile.php';

// CORS headers
header('Content-Type: application/json; charset=UTF-8');
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
$dataDir = __DIR__ . '/../../' . USERDIR . '/users';
$personaDir = __DIR__ . '/../persona';
//$userDir = $dataDir + $user // later..

try {

  //=========== Funktionen START ==========

  // JSONL-Datei: Zeilenweise Strings mit JSON-Objekten
  function readJsonl(string $file): array
  {
    if (!file_exists($file)) return [];
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $msgs = [];
    foreach ($lines as $line) {
      $obj = json_decode($line, true);
      if (is_array($obj) && isset($obj["role"], $obj["content"])) $msgs[] = $obj;
    }
    return $msgs;
  }

  // JSONL in einem Rutsch schreiben
  function saveJsonlArr(string $file, array $objs): void
  {
    $lines = [];
    foreach ($objs as $obj) {
      $lines[] = json_encode($obj, JSON_UNESCAPED_UNICODE);
    }
    file_put_contents($file, implode("\n", $lines) . "\n", LOCK_EX);
  }

  //=========== Funktionen ENDE ==========

  // =========== Hauptprogramm START ==========

  if ($log > 2) { // ***DEV***
    $xlog .= " (***DEV*** sessionId:" . ($_REQUEST['sessionId'] ?? '');
    $xlog .= " user:'" . ($_REQUEST['user'] ?? '') . "'";
    $xlog .= " persona:'" . ($_REQUEST['persona'] ?? '') . "'";
    $xlog .= " text:'" . ($_REQUEST['text'] ?? '') . "' ***DEV***)";
  }


  // Validate and sanitize user
  $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
  if (strlen($user) < 6 || strlen($user) > 32) {
    http_response_code(401);
    throw new Exception('Access denied'); // Nix preisgeben!
  }
  $userDir = $dataDir . '/' . $user;
  $xlog .= " User:'$user'";

  $sessionId = $_REQUEST['sessionId'] ?? '';
  $accessFile = $userDir . '/access.json.php';
  if (strlen($sessionId) == 32 && file_exists($accessFile)) {
    $access = json_decode(file_get_contents($accessFile), true);
  }
  if (empty($access) || (@$access['sessionId'] !== $sessionId)) {
    http_response_code(401);
    throw new Exception('Access denied'); // Nix preisgeben!
  }
  // $xlog .= " SessionID:'$sessionId'";

  // User Frage-Text
  $question = trim(str_replace(["\r\n", "\n", "\r"], ' ', $_REQUEST['text'] ?? ''), " \n\r\t\v\0\"");
  if (!$question) {
    http_response_code(400);
    throw new Exception('ERROR: No Text');
  }
  $xlog .= " Question:'$question'";

  // ---- Persona aus Datei laden ----
  // Validate and sanitize user
  $persona = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['persona'] ?? 'unknown');
  if (strlen($persona) < 3 || strlen($persona) > 32) {
    http_response_code(400);
    throw new Exception('ERROR: Persona invalid'); // Nix preisgeben!
  }
  $xlog .= " Persona:'$persona'";

  $personaFile = $personaDir . '/' . 'persona_' . $persona . '.json';
  if (file_exists($personaFile)) {
    $personaSetting = json_decode(file_get_contents($personaFile), true);
  } else {
    http_response_code(400);
    throw new Exception("ERROR: Unknown persona '$persona'"); // Nix preisgeben!
  }
  // Debug: Persona zeigen & Exit:
  // echo json_encode($personaSetting, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ); exit; // DEBUG

  // Log ----response - Chats liegen in Subdir----
  $chatDir = $userDir . '/chat';
  if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
    http_response_code(500);
    throw new Exception('Failed to create user/chat directory');
  }

  // ========= Prompt zusammenbauen =========
  $system_prompt = $personaSetting['systemprompt'] ?? "You are an assistant";
  $historyTurns = (int)($personaSetting['setup']['turns'] ?? 0); // Anzahl der vorherigen User/Assistant-Turns im Verlauf

  $historyFile = $userDir . '/chat/history.jsonl';
  $all = readJsonl($historyFile);
  $history = array_slice($all, -$historyTurns * 2); // nimm max. die letzten x Messages/Zeilen (10 Turns)

  /** ---------- Messages ---------- */
  // Request-Nachrichten: System + Verlauf
  $messages = array_merge(
    [["role" => "system", "content" => $system_prompt]],
    $history,
    [["role" => "user", "content" => $question]]
  );

  $payload = $personaSetting['payload'] ?? [];
  $payload['input'] = $messages;

  if ($log > 1) $payload['store'] = true; // Loggen erlauben ***DEV***

  // Debug: Payload zeigen & Exit:
  //  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);  exit;

  // ======== OpenAI Chat API aufrufen =========
  if (empty($SIMULATION_FILE)) { // PLAN A: Echtaufruf

    $ch = curl_init("https://api.openai.com/v1/responses");
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "Authorization: Bearer " . $apiKey,
      ],
      CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
      CURLOPT_TIMEOUT => 60,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    //curl_close($ch);

    if ($response === false) {
      http_response_code(502);
      throw new Exception('ERROR: cURL: ' . $curlErr);
    }

    //echo $response;  exit; // #### Debug

    //----------------- Antwort Vor-Decodieren ---------------
    $result = json_decode($response, true);

    if (!is_array($result)) {
      throw new RuntimeException("Invalid JSON: " . $raw);
    }
    if ($httpCode >= 400) {
      http_response_code($httpCode);
      throw new Exception('ERROR: OpenAI ' . ($result["error"]["message"] ?? $response));
    }

    if ($httpCode < 200 || $httpCode >= 300) {
      http_response_code(502);
      throw new Exception('ERROR: OpenAI API HTTP:' . $httpCode);
    }

    //--------------------- Haupt-Decodierung----------------
  } // PLAN A ENDE
  else {
    // Plan B: Extrahiere den Text und parse ihn als JSON
    $result = json_decode(file_get_contents($chatDir . '/' . $SIMULATION_FILE), true); // ***DEV***
    $response = "{}";
  }
  $jsonText = $result['output'][0]['content'][0]['text'] ?? "";

  // Bis hierher OK -echo json_encode($jsonText, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);   exit;

  $obj = json_decode($jsonText, true);


  // Verlauf speichern (JSONL, 2 Zeilen)

  $messages2save = array_merge(
    $history,
    [["role" => "user", "content" => $question]],
    [["role" => "assistant", "content" => json_encode($obj, JSON_UNESCAPED_UNICODE)]]
  );
  
  // Nur die letzten $historyTurns * 2 Zeilen behalten
  if (count($messages2save) > $historyTurns * 2) {
    $messages2save = array_slice($messages2save, -$historyTurns * 2);
  }
  
  saveJsonlArr($historyFile, $messages2save);



  //echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);



  // Log ----response - Chats liegen in Subdir - Exakt was OpenAI von sich gibt ----
  if ($log > 1) {
    $txtfname = 'que_' . date('Ymd_His') . '.json';
    file_put_contents($chatDir . '/' . $txtfname, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    $logfname = 'res_' . date('Ymd_His') . '.json';
    file_put_contents($chatDir . '/' . $logfname, $response);

    $xlog .= " Text:$txtfname Response:'$logfname'";
  }


  //echo $response;  exit; // DEBUG

  http_response_code(201); // Success - Was Neues


  $reply = json_decode($response, true);

  echo json_encode(['success' => true, 'result' => $obj ?? ''], JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
  // Error handling
  if (http_response_code() === 200) {
    http_response_code(500);
  }
  echo json_encode([
    'success' => false,
    'error' => $e->getMessage()
  ], JSON_UNESCAPED_SLASHES);
  $xlog = "ERROR:'" . $e->getMessage() . "' " . $xlog;
  $ip = $_SERVER['REMOTE_ADDR'];
  if (!empty($ip))  $xlog = "IP:$ip " . $xlog;
}
log2file($xlog);
