<?php

/*
* OpenAI Chat mit Persona
* http://localhost/wrk/ai/playground/sw/api/oai_chat.php?user=juergen&sessionid=502cdd84fde8378e9e03df33e68f72a8&text=Wer_bist_Du

*/

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, 1: Logfile schreiben 2: Log complete Reply
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

  // Validate and sanitize user
  $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
  if (strlen($user) < 6 || strlen($user) > 32) {
    http_response_code(401);
    throw new Exception('Access denied'); // Nix preisgeben!
  }
  $userDir = $dataDir . '/' . $user;
  $xlog .= " User:'$user'";

  $sessionId = $_REQUEST['sessionid'] ?? '';
  $accessFile = $userDir . '/access.json';
  if (strlen($sessionId) == 32 && file_exists($accessFile)) {
    $access = json_decode(file_get_contents($accessFile), true);
  }
  if (! !empty($access) || (@$access['sessionId'] !== $sessionId)) {
    http_response_code(401);
    throw new Exception('Access denied'); // Nix preisgeben!
  }
  // $xlog .= " SessionID:'$sessionId'";

  // QUerry
  $text = trim(str_replace(["\r\n", "\n", "\r"], ' ', $_REQUEST['text'] ?? ''), " \n\r\t\v\0\"");
  if (!$text) {
    http_response_code(400);
    throw new Exception('ERROR: Kein Text');
  }
  // ---- Persona aus Datei laden ----
  $personaFile = $personaDir . '/' . 'persona_simjo.json';
  if (file_exists($personaFile)) {
    $prompt = json_decode(file_get_contents($personaFile), true);
  } else {
    http_response_code(400);
    throw new Exception('ERROR: No persona defined');
  }
  $xlog .= " Text:'$text'";

  // ---- OpenAI Chat API aufrufen ----
  $existingConversationId = null;
  $prompt['input'][0]['content'] = $text;
  if ($existingConversationId) $prompt['conversation'] = $existingConversationId;

 //echo json_encode($prompt, JSON_UNESCAPED_SLASHES); exit;

  $ch = curl_init("https://api.openai.com/v1/responses");
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
      "Content-Type: application/json",
      "Authorization: Bearer " . $apiKey,
    ],
    CURLOPT_POSTFIELDS => json_encode($prompt, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 30,
  ]);

  $response = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlErr = curl_error($ch);
  //curl_close($ch);

  if ($response === false) {
    http_response_code(502);
    throw new Exception('ERROR: cURL: ' . $curlErr);
  }
  echo $response; exit; // Debug

  $result = json_decode($response, true);
  if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code(502);
    throw new Exception('ERROR: OpenAI API HTTP ' . $httpCode);
  }

  // Log ----response - Chats liegen in Subdir----
  if ($log > 1) {
    $chatDir = $userDir . '/chat';
    if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
      http_response_code(500);
      throw new Exception('Failed to create user/chat directory');
    }
    file_put_contents($chatDir . '/chat_' . date('Ymd_His') . '.json', $response);
  }

  $xlog .= " Response:'$response'";

  echo $response;
  exit;

  http_response_code(201); // Success - Was Neues
  $reply = json_decode($response, true);
  echo json_encode(['success' => true, 'text' => $reply['text'] ?? ''], JSON_UNESCAPED_SLASHES);
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
  if ( !empty($ip))  $xlog = "IP:$ip " . $xlog;
}
log2file($xlog);
