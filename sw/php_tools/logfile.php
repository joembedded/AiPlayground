<?php
// Logging functions - tobeincluded - requires loglevel $log global
// 2-Level logging to database

declare(strict_types=1);

include_once __DIR__ . '/db.php';

$mtmain_t0 = microtime(true);         // for Benchmark 
function log2file(string $line): void
{
    global $log, $mtmain_t0; // loglevel
    if ($log > 0) {
        try {
            $pdo = getDbConnection();
            ensureDbSchema($pdo);

            $microtime = microtime(true);
            $mtrun = round(($microtime - $mtmain_t0) * 1000, 0);
            $milliseconds = round(($microtime - floor($microtime)) * 1000);
            $date = date('Y-m-d H:i:s', (int)$microtime) . '.' . $milliseconds . ' (' . $mtrun . 'ms)';

            $stmt = $pdo->prepare('INSERT INTO log_entries (created_at, line) VALUES (NOW(), ?)');
            $stmt->execute(["[$date] $line"]);

            $trimStmt = $pdo->prepare(
                'DELETE FROM log_entries WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM log_entries ORDER BY id DESC LIMIT ?
                    ) AS keep_rows
                )'
            );
            $trimStmt->bindValue(1, 1000, PDO::PARAM_INT);
            $trimStmt->execute();
        } catch (Exception $e) { // Silent
        }
    }
}
