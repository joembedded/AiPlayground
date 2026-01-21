<?php

declare(strict_types=1);

function getDbConfigValue(string $key): ?string
{
    if (defined($key)) {
        $value = constant($key);
        if (is_string($value) && $value !== '') {
            return $value;
        }
    }

    $envValue = getenv($key);
    if ($envValue !== false && $envValue !== '') {
        return $envValue;
    }

    return null;
}

function getDbConnection(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getDbConfigValue('DB_HOST');
    $name = getDbConfigValue('DB_NAME');
    $user = getDbConfigValue('DB_USER');
    $pass = getDbConfigValue('DB_PASS') ?? '';

    if (empty($host) || empty($name) || empty($user)) {
        throw new Exception('Database configuration missing');
    }

    $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function ensureDbSchema(PDO $pdo): void
{
    static $initialized = false;
    if ($initialized) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS user_data (
            username VARCHAR(32) PRIMARY KEY,
            credentials_json LONGTEXT NOT NULL,
            credits_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS user_sessions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            session_id CHAR(32) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE KEY session_id_unique (session_id),
            INDEX username_idx (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_history (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            role VARCHAR(16) NOT NULL,
            content LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX username_idx (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS chat_logs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            log_type VARCHAR(16) NOT NULL,
            payload LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX username_idx (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tts_cache (
            cache_key VARCHAR(128) PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            voice VARCHAR(32) NOT NULL,
            format VARCHAR(8) NOT NULL,
            content_type VARCHAR(64) NOT NULL,
            audio_blob LONGBLOB NOT NULL,
            created_at DATETIME NOT NULL,
            accessed_at DATETIME NOT NULL,
            INDEX username_idx (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stt_uploads (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) NOT NULL,
            filename VARCHAR(128) NOT NULL,
            mime_type VARCHAR(64) NOT NULL,
            audio_blob LONGBLOB NOT NULL,
            response_json LONGTEXT NULL,
            debug_only TINYINT(1) NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX username_idx (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS log_entries (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            created_at DATETIME NOT NULL,
            line TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $initialized = true;
}

function fetchUserData(PDO $pdo, string $username): ?array
{
    $stmt = $pdo->prepare('SELECT credentials_json, credits_json FROM user_data WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $credentials = json_decode($row['credentials_json'], true);
    $credits = json_decode($row['credits_json'], true);

    if (!is_array($credentials) || !is_array($credits)) {
        return null;
    }

    return ['credentials' => $credentials, 'credits' => $credits];
}

function saveUserData(PDO $pdo, string $username, array $credentials, array $credits): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO user_data (username, credentials_json, credits_json, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE credentials_json = VALUES(credentials_json), credits_json = VALUES(credits_json), updated_at = NOW()'
    );
    $stmt->execute([
        $username,
        json_encode($credentials, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        json_encode($credits, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);
}

function updateUserCredits(PDO $pdo, string $username, array $credits): void
{
    $stmt = $pdo->prepare('UPDATE user_data SET credits_json = ?, updated_at = NOW() WHERE username = ?');
    $stmt->execute([
        json_encode($credits, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $username,
    ]);
}

function createUserSession(PDO $pdo, string $username, string $sessionId): void
{
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare(
        'INSERT INTO user_sessions (username, session_id, created_at, updated_at)
        VALUES (?, ?, NOW(), NOW())'
    );
    $stmt->execute([$username, $sessionId]);
}

function validateUserSession(PDO $pdo, string $username, string $sessionId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM user_sessions WHERE username = ? AND session_id = ?');
    $stmt->execute([$username, $sessionId]);
    return (bool)$stmt->fetchColumn();
}

function deleteUserSession(PDO $pdo, string $username, string $sessionId): void
{
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE username = ? AND session_id = ?');
    $stmt->execute([$username, $sessionId]);
}

function deleteUserData(PDO $pdo, string $username): void
{
    $stmt = $pdo->prepare('DELETE FROM user_sessions WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare('DELETE FROM chat_history WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare('DELETE FROM chat_logs WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare('DELETE FROM tts_cache WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare('DELETE FROM stt_uploads WHERE username = ?');
    $stmt->execute([$username]);

    $stmt = $pdo->prepare('DELETE FROM user_data WHERE username = ?');
    $stmt->execute([$username]);
}

function fetchChatHistory(PDO $pdo, string $username, int $limit): array
{
    $stmt = $pdo->prepare('SELECT role, content FROM chat_history WHERE username = ? ORDER BY id DESC LIMIT ?');
    $stmt->bindValue(1, $username);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $messages = [];
    foreach (array_reverse($rows) as $row) {
        $messages[] = ['role' => $row['role'], 'content' => $row['content']];
    }

    return $messages;
}

function appendChatHistory(PDO $pdo, string $username, array $messages, int $limit): void
{
    $stmt = $pdo->prepare('INSERT INTO chat_history (username, role, content, created_at) VALUES (?, ?, ?, NOW())');
    foreach ($messages as $message) {
        $stmt->execute([$username, $message['role'], $message['content']]);
    }

    $trimStmt = $pdo->prepare(
        'DELETE FROM chat_history WHERE username = ? AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM chat_history WHERE username = ? ORDER BY id DESC LIMIT ?
            ) AS keep_rows
        )'
    );
    $trimStmt->bindValue(1, $username);
    $trimStmt->bindValue(2, $username);
    $trimStmt->bindValue(3, $limit, PDO::PARAM_INT);
    $trimStmt->execute();
}

function logChatPayload(PDO $pdo, string $username, string $type, string $payload): void
{
    $stmt = $pdo->prepare('INSERT INTO chat_logs (username, log_type, payload, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$username, $type, $payload]);
}

function fetchTtsCache(PDO $pdo, string $cacheKey): ?array
{
    $stmt = $pdo->prepare('SELECT audio_blob, content_type FROM tts_cache WHERE cache_key = ?');
    $stmt->execute([$cacheKey]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $touch = $pdo->prepare('UPDATE tts_cache SET accessed_at = NOW() WHERE cache_key = ?');
    $touch->execute([$cacheKey]);

    $audioBlob = $row['audio_blob'];
    if (is_resource($audioBlob)) {
        $audioBlob = stream_get_contents($audioBlob);
    }

    return [
        'audio_blob' => $audioBlob,
        'content_type' => $row['content_type'],
    ];
}

function saveTtsCache(PDO $pdo, string $cacheKey, string $username, string $voice, string $format, string $contentType, string $audioBlob): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO tts_cache (cache_key, username, voice, format, content_type, audio_blob, created_at, accessed_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE audio_blob = VALUES(audio_blob), content_type = VALUES(content_type), accessed_at = NOW()'
    );
    $stmt->bindValue(1, $cacheKey);
    $stmt->bindValue(2, $username);
    $stmt->bindValue(3, $voice);
    $stmt->bindValue(4, $format);
    $stmt->bindValue(5, $contentType);
    $stmt->bindValue(6, $audioBlob, PDO::PARAM_LOB);
    $stmt->execute();
}

function saveSttUpload(PDO $pdo, string $username, string $filename, string $mimeType, string $audioBlob, bool $debugOnly): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO stt_uploads (username, filename, mime_type, audio_blob, debug_only, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $stmt->bindValue(1, $username);
    $stmt->bindValue(2, $filename);
    $stmt->bindValue(3, $mimeType);
    $stmt->bindValue(4, $audioBlob, PDO::PARAM_LOB);
    $stmt->bindValue(5, $debugOnly ? 1 : 0, PDO::PARAM_INT);
    $stmt->execute();

    return (int)$pdo->lastInsertId();
}

function updateSttResponse(PDO $pdo, int $uploadId, string $responseJson): void
{
    $stmt = $pdo->prepare('UPDATE stt_uploads SET response_json = ? WHERE id = ?');
    $stmt->execute([$responseJson, $uploadId]);
}
