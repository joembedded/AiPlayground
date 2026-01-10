<?php

/**
 * OpenAI Chat mit Persona
 * http://localhost/wrk/ai/playground/sw/api/oai_chat.php?user=TESTUSER&sessionid=355c6639f2cfef7ab651286ef9a6d488&text=Wer_bist_Du
 */

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, 1: Logfile schreiben, 2: Log complete Reply
//$SIMULATION_RESP = "res_20260109_233809.json"; // Wenn gesetzt: Return Konserven-Datei statt OpenAI (***DEV***)


$xlog = "oai_chat";
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

// ========== Funktionen ==========

/**
 * JSONL-Datei einlesen: Zeilenweise Strings mit JSON-Objekten
 */
function readJsonl(string $file): array
{
  if (!file_exists($file)) {
    return [];
  }

  $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  $msgs = [];

  foreach ($lines as $line) {
    $obj = json_decode($line, true);
    if (is_array($obj) && isset($obj["role"], $obj["content"])) {
      $msgs[] = $obj;
    }
  }

  return $msgs;
}

/**
 * JSONL-Array in einem Rutsch schreiben
 */
function saveJsonlArr(string $file, array $objs): void
{
  $lines = [];
  foreach ($objs as $obj) {
    $lines[] = json_encode($obj, JSON_UNESCAPED_UNICODE);
  }
  file_put_contents($file, implode("\n", $lines) . "\n", LOCK_EX);
}

/*
Antwort-Array zerlegen. 
Achtung: Es kann sein, dass die ANtwort mehrer JSON-Bloecke in text eenthält. I.d.R: zwar nur 1,
aber kam auch schon vor, dass mehrere da sind (z.B. bei Refusals).
*/

function extractAssistantTextFromResponses($result): array|string
{
  // JSON  Array
  if (is_string($result)) {
    $data = json_decode($result, true);
    if (!is_array($data)) {
      return "Extract1";
    }
  } elseif (is_array($result)) {
    $data = $result;
  } else {
    return "Extract2";
  }

  if (!isset($data["output"]) || !is_array($data["output"])) {
    return "Extract3";
  }

  $texts = [];

  foreach ($data["output"] as $item) {
    // Nur Assistant-Messages

    if (
      ($item["type"] ?? null) !== "message" ||
      ($item["role"] ?? null) !== "assistant"
    ) {
      continue;
    }

    if (!isset($item["content"]) || !is_array($item["content"])) {
      continue;
    }

    foreach ($item["content"] as $part) {
      //echo "\n-----------\n".json_encode($part, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
      if (
        ($part["type"] ?? null) === "output_text" &&
        isset($part["text"]) &&
        is_string($part["text"])
      ) {
        $partText = $part["text"];
        //echo "\n-----------\n".json_encode($partText, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $texts[] = $partText;
      }
    }
  }

  return $texts;
}




// ========== Hauptprogramm ==========

try {

  // Debug-Logging (DEV)
  if ($log > 2) {
    $xlog .= " (***DEV*** sessionId:" . ($_REQUEST['sessionId'] ?? '');
    $xlog .= " user:'" . ($_REQUEST['user'] ?? '') . "'";
    $xlog .= " persona:'" . ($_REQUEST['persona'] ?? '') . "'";
    $xlog .= " text:'" . ($_REQUEST['text'] ?? '') . "' ***DEV***)";
  }

  // Validate and sanitize user
  $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
  if (strlen($user) < 6 || strlen($user) > 32) {
    http_response_code(401);
    throw new Exception('Access denied');
  }
  $userDir = $dataDir . '/' . $user;
  $xlog .= " User:'$user'";

  // Validate session
  $sessionId = $_REQUEST['sessionId'] ?? '';
  $accessFile = $userDir . '/access.json.php';
  $access = null;

  if (strlen($sessionId) == 32 && file_exists($accessFile)) {
    $access = json_decode(file_get_contents($accessFile), true);
  }

  if (empty($access) || (@$access['sessionId'] !== $sessionId)) {
    http_response_code(401);
    throw new Exception('Access denied');
  }

  // User Frage-Text
  $question = trim(str_replace(["\r\n", "\n", "\r"], ' ', $_REQUEST['text'] ?? ''), " \n\r\t\v\0\"");
  if (!$question) {
    http_response_code(400);
    throw new Exception('ERROR: No Text');
  }
  $xlog .= " Question:'$question'";

  // Validate and sanitize persona
  $persona = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['persona'] ?? 'unknown');
  if (strlen($persona) < 3 || strlen($persona) > 32) {
    http_response_code(400);
    throw new Exception('ERROR: Persona invalid');
  }
  $xlog .= " Persona:'$persona'";

  // Persona aus Datei laden
  $personaFile = $personaDir . '/persona_' . $persona . '.json';
  if (file_exists($personaFile)) {
    $personaSetting = json_decode(file_get_contents($personaFile), true);
  } else {
    http_response_code(400);
    throw new Exception("ERROR: Unknown persona '$persona'");
  }

  // Optional pcmd (als Developer-Cmd)
  $dvlpCmd = trim($_REQUEST['pcmd'] ?? '');
  // Sanitize voice command
  $dvlpCmd = preg_replace('/[^\w\s.,!?:=;<>-]/u', ' ', $dvlpCmd);
  if (strlen($dvlpCmd) > 500) {
    http_response_code(500);
    throw new Exception('PCmd not 0-500 characters');
  }

  if (strlen($dvlpCmd) > 0) {
    $xlog .= " vcmd:'" . substr($dvlpCmd, 0, 50) . (strlen($dvlpCmd) > 50 ? "...'" : "'");
    $cache = false; // Kein Cache bei pcmd
  }

  // Chat-Verzeichnis erstellen
  $chatDir = $userDir . '/chat';
  if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
    http_response_code(500);
    throw new Exception('Failed to create user/chat directory');
  }

  // Prompt zusammenbauen
  $system_prompt = $personaSetting['systemprompt'] ?? "You are an assistant";
  $historyTurns = (int)($personaSetting['setup']['turns'] ?? 0);

  // Platzhalter ${filename} durch Dateiinhalt ersetzen
  $system_prompt = preg_replace_callback(
    '/\$\{([^}]+)\}/',
    function ($matches) use ($personaDir) {
      $filename = trim($matches[1]);
      $filepath = $personaDir . '/' . $filename;

      if (file_exists($filepath)) {
        return file_get_contents($filepath);
      } else {
        // Falls Datei nicht existiert, Platzhalter beibehalten oder Warnung
        return $matches[0]; // Original-Platzhalter beibehalten
      }
    },
    $system_prompt
  );

  // Wichtig: Kommentar als Zeile behalten!
  //echo "-------- Systemprompt: -------\n$system_prompt\n--------------\n; exit; 

  $historyFile = $userDir . '/chat/history.jsonl';
  $all = readJsonl($historyFile);
  $history = array_slice($all, -$historyTurns * 2);

  // Request-Nachrichten: System + Verlauf + opt. Developer + aktuelle Frage
  $messages = array_merge(
    [["role" => "system", "content" => $system_prompt]],
    $history
  );
  if (strlen($dvlpCmd) > 0) {
    $messages[] = ["role" => "developer", "content" => $dvlpCmd];
  }
  $messages[] = ["role" => "user", "content" => $question];

  // Wichtig: Dbg: ALles anzeigen und Exit (***DEV***)
  //echo json_encode(($messages), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);  exit;

  $payload = $personaSetting['payload'] ?? [];
  $payload['input'] = $messages;

  if ($log > 1) {
    $payload['store'] = true; // Loggen erlauben (DEV)
  }

  // Wichtig: Dbg: ALles anzeigen und Exit (***DEV***)
  //echo json_encode(($payload), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);  exit;


  // OpenAI Chat API aufrufen
  if (empty($SIMULATION_RESP)) {

    if ($log > 1) { // Vorher loggen, falls was schiefgeht
      $txtfname = 'que_' . date('Ymd_His') . '.json';
      file_put_contents($chatDir . '/' . $txtfname, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    // Echtaufruf
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
    // curl_close($ch); Deprecated

    if ($response === false) {
      http_response_code(502);
      throw new Exception('ERROR: cURL: ' . $curlErr);
    }

    // Antwort decodieren
    $result = json_decode($response, true);

    if (!is_array($result)) {
      throw new RuntimeException("Invalid JSON response");
    }

    if ($httpCode >= 400) {
      http_response_code($httpCode);
      throw new Exception('ERROR: OpenAI ' . ($result["error"]["message"] ?? $response));
    }

    if ($httpCode < 200 || $httpCode >= 300) {
      http_response_code(502);
      throw new Exception('ERROR: OpenAI API HTTP:' . $httpCode);
    }
  } else {
    // Simulation: Datei statt OpenAI (DEV)
    $result = json_decode(file_get_contents($chatDir . '/' . $SIMULATION_RESP), true);
    $response = "{}";
  }

  // Das ist bissl kniffelig mit den ganzen IDs, Msg, ..
  $answerArrOStr = extractAssistantTextFromResponses($result);
  if (is_array($answerArrOStr)) {
    $acnt = count($answerArrOStr);
    if ($acnt > 0) {
      if ($acnt > 1) $xlog .= " (ERR:Multiple answers:$acnt)";
      // Bei langen ANtworten evtl. Fehlstellen am Ende, daher von hinten nach vorn suchen, bis was OK
      while ($acnt > 0) {
        $acnt--;
        $obj = json_decode($answerArrOStr[$acnt], true);
        if (is_array($obj) && isset($obj['answer'])) {
          break;
        }
        $xlog .= " (ERR:Answer not JSON:$acnt)";
      }
    } else $xlog .= " (ERR:No answers)";
  } else if (is_string($answerArrOStr)) {
    $xlog .= " (ERR:$answerArrOStr)";
  }

  // WICHTIG: Dbg: Antwort anzeigen und Exit (***DEV***)
  // echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);  exit;

  // Refusals halten sich wohl nicht ans Schema? Kommt immer als Text?
  if (empty($obj)) {
    if ($result['output'][0]['content'][0]['type'] === "refusal") {
      $rreason = $result['output'][0]['content'][0]['refusal'] ?? "(Refused without reason)";
      $obj = ["answer" => ["text" => $rreason]];
    }
  }

  if (empty($SIMULATION_RESP)) { // Verlauf speichern (JSONL)
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

    // Request und Response loggen (optional)
    if ($log > 1) {
      $logfname = 'res_' . date('Ymd_His') . '.json';
      file_put_contents($chatDir . '/' . $logfname, $response);

      $xlog .= " Text:$txtfname Response:'$logfname'";
    }
  }

  http_response_code(201);
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
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  if (!empty($ip)) {
    $xlog = "IP:$ip " . $xlog;
  }
}

log2file($xlog);
