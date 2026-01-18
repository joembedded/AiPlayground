<?php
// Logging functions - tobeincluded - requires USERDIR and loglevel $loglevel global
// 2-Level logging to file
function log2file(string $line): void
{
    global $log; // loglevel
    if ($log > 0) {
        try {
            $logpath = __DIR__ . '/../../' . USERDIR . '/logs';
            if (!is_dir($logpath))  mkdir($logpath, 0755, true);
            $logfile = $logpath . '/logfile.log';
            // Rotate log if > 100KB
            if (file_exists($logfile) && filesize($logfile) > 100 * 1024) {
                $logfileOld = $logpath . '/logfile_old.log';
                if (file_exists($logfileOld)) {
                    @unlink($logfileOld);
                }
                @rename($logfile, $logfileOld);
            }
            $microtime = microtime(true);
            $milliseconds = round(($microtime - floor($microtime)) * 1000);
            $date = date('Y-m-d H:i:s', (int)$microtime) . '.' . $milliseconds;
            file_put_contents($logfile, "[$date] $line" . PHP_EOL, FILE_APPEND | LOCK_EX);
        } catch (Exception $e) { // Silent
        }
    }
}
