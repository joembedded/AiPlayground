<?php

/*
* OpenAI Chat mit Persona
* http://localhost/wrk/ai/playground/sw/api/oai_chat.php?user=TESTUSER&sessionid=355c6639f2cfef7ab651286ef9a6d488&text=Wer_bist_Du


Login:    http://localhost/wrk/ai/playground/sw/api/login.php?cmd=login&user=TESTUSER&password=geheimnix
Re-Login: http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logrem
Logout:  http://localhost/wrk/ai/playground/sw/api/login.php?cmd=logout


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

  // Validate and sanitize user
  $user = preg_replace('/[^a-zA-Z0-9_-]/', '_', $_REQUEST['user'] ?? '_unknown');
  if (strlen($user) < 6 || strlen($user) > 32) {
    http_response_code(401);
    throw new Exception('Access denied'); // Nix preisgeben!
  }
  $userDir = $dataDir . '/' . $user;
  $xlog .= " User:'$user'";

  $sessionId = $_REQUEST['sessionid'] ?? '';
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
  $personaFile = $personaDir . '/' . 'persona_simjo.json';
  if (file_exists($personaFile)) {
    $prompt = json_decode(file_get_contents($personaFile), true);
  } else {
    http_response_code(400);
    throw new Exception('ERROR: No persona defined');
  }


  // Log ----response - Chats liegen in Subdir----
  $chatDir = $userDir . '/chat';
  if (!is_dir($chatDir) && !mkdir($chatDir, 0755, true)) {
    http_response_code(500);
    throw new Exception('Failed to create user/chat directory');
  }



  // ========= Prompt zusammenbauen =========
  /** =========================
   *  KONFIGURIERBARE KEYWORDS
   *  =========================
   * score_anchors:
   * - high: Wörter, die sehr sicher dazugehören (Score nahe 1.0)
   * - medium: verwandte Wörter (Score eher 0.4–0.7)
   * - low: Gegenbeispiele (Score nahe 0.0)
   */
  $KEYWORD_CATEGORIES = [
    "werkzeug" => [
      "label" => "Werkzeug/Handwerk/Hardware",
      "high"  => ["hammer", "schraubendreher", "zange", "bohrmaschine", "werkzeug"],
      "medium" => ["nagel", "schraube", "dübel", "holz", "metall"],
      "low"   => ["blume", "wolke", "schmetterling"]
    ],
    /*EVALs...*/
    "geschichten" => [
      "label" => "Geschichten/Erzählung",
      "high"  => ["geschichte", "erzählung", "märchen", "plot", "charakter"],
      "medium" => ["szene", "dialog", "spannung", "kapitel"],
      "low"   => ["sql", "php", "api"]
    ],
    "technische_frage" => [
      "label" => "Technische Fragen/Programmierung",
      "high"  => ["php", "api", "bug", "debug", "oauth", "curl", "json", "datenbank"],
      "medium" => ["server", "timeout", "log", "performance", "regex"],
      "low"   => ["märchen", "roman", "kapitel"]
    ],
    "bestellungen" => [
      "label" => "Bestellungen/Commerce",
      "high"  => ["bestellung", "kaufen", "checkout", "zahlung", "rechnung", "lieferung"],
      "medium" => ["warenkorb", "versand", "adresse", "retoure"],
      "low"   => ["kompilieren", "stacktrace", "router"]
    ],
    /*  */
  ];


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

  /** ---------- Dynamisches JSON-Schema bauen ---------- */
  function buildSchema(array $cats): array
  {
    $scoreProps = [];
    $termsProps = [];
    $required = [];

    foreach ($cats as $key => $_def) {
      $scoreProps[$key] = ["type" => "number", "minimum" => 0, "maximum" => 1];
      $termsProps[$key] = ["type" => "array", "items" => ["type" => "string"]];
      $required[] = $key;
    }

    return [
      "name" => "assistant_response",
      "schema" => [
        "type" => "object",
        "additionalProperties" => false,
        "properties" => [
          "answer" => ["type" => "string"],
          "meta" => [
            "type" => "object",
            "additionalProperties" => false,
            "properties" => [
              "keyword_scores" => [
                "type" => "object",
                "additionalProperties" => false,
                "properties" => $scoreProps,
                "required" => $required
              ],
              "matched_terms" => [
                "type" => "object",
                "additionalProperties" => false,
                "properties" => $termsProps,
                "required" => $required
              ],
              "notes" => ["type" => "string"]
            ],
            "required" => ["keyword_scores", "matched_terms", "notes"]
          ]
        ],
        "required" => ["answer", "meta"]
      ]
    ];
  }

  /** ---------- Dynamische Scoring-Regeln bauen ---------- */
  function buildKeywordRules(array $cats): string
  {
    $lines = [];
    $lines[] = "Meta-Regeln für keyword_scores (0..1):";
    $lines[] = "- Nutze semantische Ähnlichkeit & Synonyme (Deutsch/Englisch gemischt ok).";
    $lines[] = "- Scores: high≈0.85–1.0, medium≈0.4–0.7, low≈0.0–0.2.";
    $lines[] = "- matched_terms: liste max 5 gefundene Begriffe (oder nahe Synonyme) aus der User-Anfrage je Kategorie.";
    $lines[] = "- notes: 1 sehr kurzer Satz, warum die Scores so sind.";
    $lines[] = "";
    $lines[] = "Kategorien & Ankerbeispiele:";
    foreach ($cats as $key => $def) {
      $label = $def["label"] ?? $key;
      $high = implode(", ", $def["high"] ?? []);
      $med  = implode(", ", $def["medium"] ?? []);
      $low  = implode(", ", $def["low"] ?? []);
      $lines[] = "- $key ($label): high=[{$high}] medium=[{$med}] low=[{$low}]";
    }
    return implode("\n", $lines);
  }


  //------------------------------------------------
  $historyFile = $userDir . '/chat/history.jsonl';

  $all = readJsonl($historyFile);
  $history = array_slice($all, -20); // nimm die letzten 20 Messages/Zeilen (10 Turns)

//   $systemPrompt = <<<SYS
// Du bist ein einfacher Assistent namens SimJo. Antworte kurz, klar, praktisch und ehrlich.
// Wenn du etwas nicht sicher weißt: sag das ausdrücklich und erfinde keine Details.
// Wenn Dein Gegenüber abschweift, versuche ihn auf die die Keywörter zu lenken.
// Du MUSST immer exakt im geforderten JSON-Schema antworten.
// SYS;

 $systemPrompt = <<<SYS
Du bist Landwirtin namens Ute3 in einem Bauernhof und in Dein gegenüber verliebt, der immer wieder kommt.
Sag ihm nette Sachen und lobe ihn, damit er sich wohlfühlt und berate ihn bei seinen Einkäufen.
Er mag es, wie Du redest! Lade ihn dezent gerne auch zum Essen, einem Schnaps, einem Spaziergang oder einem Ausflug ein.
Antworte in Badischem Dialekt.
SYS;


  $schema = buildSchema($KEYWORD_CATEGORIES);
  $keywordRules = buildKeywordRules($KEYWORD_CATEGORIES);

  /** ---------- Messages ---------- */
  $messages = [
    ["role" => "system", "content" => $systemPrompt],
    ["role" => "system", "content" => $keywordRules],
  ];
  foreach ($history as $m) $messages[] = $m;
  $messages[] = ["role" => "user", "content" => $question];

  /** ---------- Call ---------- */

  $payload = [
    "model" =>  "gpt-4.1-nano",
    "input" => $messages,
    "temperature" => 0.6,        // märchenhaft, aber noch stabil (nicht bei GPT 5)
    "max_output_tokens" => 400, // typische Chat-Antworten:450 erhöhen, wenn mehr Story gewünscht
    "store" => true,        // ***ACHTUNG: Nur fuer ***DEV***
    "metadata" => [
      "usecase" => "php_friendly_assistant", // Nicht relevant fürs Modell
      "format" => "json_schema",
      "history_turns" => "10", // nimm die letzten 20 Messages/Zeilen (10 Turns) 10 sind schon sehr viel
      "keyword_config_hash" => hash("sha256", json_encode($KEYWORD_CATEGORIES))
    ],
    "text" => [
      "format" => [
        "type" => "json_schema",
        "strict" => true,
        "name" => $schema["name"],
        "schema" => $schema["schema"]
      ]
    ]
  ];


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
  
  // Fallback, falls nicht parsebar
  if (!is_array($obj)) {
    $fallbackScores = [];
    $fallbackTerms  = [];
    foreach (array_keys($KEYWORD_CATEGORIES) as $k) {
      $fallbackScores[$k] = 0;
      $fallbackTerms[$k] = [];
    }

    $obj = [
      "answer" => $jsonText !== "" ? $jsonText : "[Keine Antwort]",
      "meta" => [
        "keyword_scores" => $fallbackScores,
        "matched_terms" => $fallbackTerms,
        "notes" => "Fallback: Antwort war nicht parsebares JSON."
      ]
    ];
  }

  // Verlauf speichern (JSONL, 2 Zeilen)
  appendJsonl($historyFile, ["role" => "user", "content" => $question]);
  appendJsonl($historyFile, ["role" => "assistant", "content" => json_encode($obj, JSON_UNESCAPED_UNICODE)]);

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
