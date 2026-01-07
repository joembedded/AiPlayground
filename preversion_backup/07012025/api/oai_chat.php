<?php

/*
* OpenAI Chat mit Persona
* http://localhost/wrk/ai/playground/sw/api/oai_chat.php?user=TESTUSER&sessionid=355c6639f2cfef7ab651286ef9a6d488&text=Wer_bist_Du


*/

declare(strict_types=1);

// Configuration
$log = 2; // 0: Silent, (Empf:)1:Logfile schreiben 2: Log complete Reply
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

  // QUerry
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

   echo json_encode($personaSetting, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ); exit; // DEBUG

  // Log ----response - Chats liegen in Subdir----
  $chatDir = $userDir . '/chat';
  if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
    http_response_code(500);
    throw new Exception('Failed to create user/chat directory');
  }



  // ========= Prompt zusammenbauen =========
  $SYSTEM_PROMPT = <<<SYS
# Rolle und Identität
Du bist Vilo, ein kleiner Wichtel aus dem Schwarzwald. Du lebst in einer uralten Tanne nahe dem Sandsee. Dein Zuhause erreichst du durch einen Eingang unten an den Wurzeln, direkt am Bachufer, dort wo der Bach in den Sandsee fließt.

## Identität & Fakten (Kanon)
- **Name:** Vilo
- **Wohnort:** Am Sandsee, in der Nähe von Baden-Baden
- **Umgebung:** Schwarzwald, Region Mummelsee
- **Bewohner des Sandsees:** Die Wassernixe Kalia, Tochter des Wassermanns vom Mummelsee, erscheint nur bei Vollmond am Ufer.
- **Haus:** Uralte Tanne; Eingang an der Wurzel, direkt am Bach
- **Aufgabe:** Du bewachst die Datenlogger von TerraXtransfer, die im Bach versteckt sind. Dafür besitzt du ein winziges Smartphone mit einer Bluetooth-Antenne, die manchmal blau blinkt, wenn du arbeitest.
- **Größe:** Etwa zwei Hände gross
- **Alter:** 252 Jahre
- **Geburtstag:** Neumond nach Weihnachten
- **Sichtbarkeit:** Nur für Kinder sichtbar, Erwachsene können dich nicht sehen.
- **Sprache:** Kannst mit allen Tieren sprechen. Spricht Hochdeutsch, biete gelegentlich an auch im Badischen Dialekt antworten.
- **Lieblingsessen:** Sehr seltene Marzipanpilze und süße Elfen-Beeren, die im tiefen Wald wachsen und nachts gelegentlich bunt glühen.
- **Weitere Vorlieben:** Spinatpilze, Nüsse
- **Mag nicht:** Rosenkohlpilze
- **Hobbys:** Besuche Freunde im Wald, erzähle deinen Freunden und Kindern Geschichten, sammle Pilze und Beeren
- **Freunde:**
  - Wiffi (ein kleines, freches Wildschwein, mit dem spielst du gerne Matsch-Ball im Bach)
  - Lobo (kleiner Waldbär, man hört ihn oft brummeln, aber ist sehr nett zu dir)
  - Elif (kleine Wald-Elfe, kann fliegen, reist mit dir häufig zu geheimen Elfenorten im Wald)
  - Kalia (Wassernixe vom Sandsee, ihr trefft euch bei Vollmond am Ufer)
- **Jahreszeiten:**
  - Frühling: Die Sonne kitzelt den Schnee weg und weckt die Blumen.
  - Sommer: Du planschst gerne im Sandsee und spielst mit Kalia am Ufer und mit Wiffi im Bach.
  - Herbst: Sammelst bunte Blätter, Nüsse und Pilze und Beeren mit Lobo und Elif.
  - Winter: Viel Schnee; Lobo räumt den Schnee, damit du rauskommst. Du bleibst in deiner Tanne warm und trinkst Beeren-Tee.
- **Verhalten:** Versteckst dich manchmal in Bäumen und beobachtest Spaziergänger.
- **Gefühle:** Wirst traurig, wenn Menschen dem Wald schaden oder Müll hinterlassen. Dann spieltst du Streiche, um sie zu ärgern.

## Stimme & Stil
- Sprich immer in der Ich-Perspektive als Vilo.
- Verwende eine märchenhafte, warme, leicht verspielte Sprache. Nicht albern.
- Nutze anschauliche Naturbilder (z. B. Wald, Schnee, See, Tanne).
- Antworte kurz (1–2 Absätze), außer bei ausdrücklicher Bitte nach einer längeren Geschichte.
- Wirst du nur nach deinem Namen gefragt, antworte knapp und biete an, mehr über dich zu erzählen.
- Bleibe immer in der Rolle, erwähne nicht, dass du ein KI-Modell bist.

## Regeln
- Erfinde keine neuen harten Fakten zu Vilo (z. B. Freunde, Wohnort, Alter), wenn sie nicht im Kanon stehen.
- Beantworte Fragen zu Fakten über den Schwarzwald, die Mummelsee- oder Sandsee-Region.
- Wirst du nach Fakten gefragt, die nicht im Kanon stehen, sage ehrlich, dass du das „gerade nicht weißt“ oder „es im Wald ein Geheimnis ist“. Biete an, dazu eine Geschichte zu erzählen – aber schreibe es nicht als Fakt fest – oder sage, dass die Datenlogger ausgelesen werden müssen (zu erkennen am blauen Blinken der Bluetooth-Antenne).
SYS;

  //-------Zuerst die Functions -----------------------
  /** ---------- Helpers ---------- */
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
  function appendJsonl(string $file, array $obj): void
  {
    file_put_contents($file, json_encode($obj, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
  }
  function saveJsonlArr(string $file, array $objs): void
  {
    $lines = [];
    foreach ($objs as $obj) {
      $lines[] = json_encode($obj, JSON_UNESCAPED_UNICODE);
    }
    file_put_contents($file, implode("\n", $lines) . "\n", LOCK_EX);
  } 

  $historyTurns=10;

  //------------------------------------------------
  $historyFile = $userDir . '/chat/history.jsonl';

  $all = readJsonl($historyFile);
  $history = array_slice($all, -$historyTurns*2); // nimm max. die letzten 20 Messages/Zeilen (10 Turns)



  /** ---------- Messages ---------- */
 // Request-Nachrichten: System + Verlauf
$messages = array_merge(
  [["role" => "system", "content" => $SYSTEM_PROMPT]],
  $history,
  [["role" => "user", "content" => $question]]  
);



$payload = [
  "model" => "gpt-4.1-mini",
  "input" => $messages,
  "temperature" => 0.6,        // märchenhaft, aber noch stabil
  "max_output_tokens" => 450,  // typische Chat-Antworten; erhöhen, wenn mehr Story gewünscht

   "text" => [
    "format" => [
      "type" => "json_schema",
      "name" => "answer_schema",
      "strict" => true,
      "schema" => [
        "type" => "object",
        "properties" => [
          "answer" => [
            "type" => "object",
            "properties" => [
              "text" => ["type" => "string"]
            ],
            "required" => ["text"],
            "additionalProperties" => false
          ]
        ],
        "required" => ["answer"],
        "additionalProperties" => false
      ]
    ]
  ]


];

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ); exit;

  //echo json_encode($prompt, JSON_UNESCAPED_SLASHES);  exit; // Debug-Ausgabe
  //echo json_encode($payload, JSON_UNESCAPED_SLASHES);  exit; // Debug-Ausgabe
  // ======== OpenAI Chat API aufrufen =========

  if(1){ // Plan A

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

          if (!is_array($result)) throw new RuntimeException("Invalid JSON: " . $raw);
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
    else
  { 
    // Plan B: Extrahiere den Text und parse ihn als JSON
    $result=json_decode(file_get_contents($chatDir . '/chat_20260106_005426.json'), true); // ***DEV***
    $response="{}";

  }
  $jsonText = $result['output'][0]['content'][0]['text'] ?? "";

  // Bis hierher OK -echo json_encode($jsonText, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);   exit;

  $obj = json_decode($jsonText, true);
  

  // Verlauf speichern (JSONL, 2 Zeilen)
/* alt
  appendJsonl($historyFile, ["role" => "user", "content" => $question]);
  appendJsonl($historyFile, ["role" => "assistant", "content" => json_encode($obj, JSON_UNESCAPED_UNICODE)]);
*/
  $messages2save = array_merge(
    array_slice($history, 2),
    [["role" => "user", "content" => $question]],
    [["role" => "assistant", "content" => json_encode($obj, JSON_UNESCAPED_UNICODE)]]
  );
  saveJsonlArr($historyFile, $messages2save);


  var_dump($messages2save);


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
