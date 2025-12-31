<!DOCTYPE html>
<!-- http://localhost/wrk/ai/playground/sw -->
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Playground</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #2a2a2a;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: #3a3a3a;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
        }
        h1 {
            color: #e0e0e0;
            margin-bottom: 10px;
            font-size: 2em;
            font-weight: 400;
        }
        .subtitle {
            color: #999;
            margin-bottom: 30px;
            font-size: 0.9em;
        }
        .file-list {
            list-style: none;
        }
        .file-list li {
            margin-bottom: 8px;
        }
        .file-list a {
            display: block;
            padding: 12px 16px;
            background: #4a4a4a;
            border-radius: 4px;
            text-decoration: none;
            color: #d0d0d0;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
        }
        .file-list a:hover {
            background: #555;
            color: #fff;
            border-left-color: #888;
            transform: translateX(5px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .file-type {
            display: inline-block;
            padding: 2px 8px;
            background: #666;
            color: #e0e0e0;
            border-radius: 2px;
            font-size: 0.75em;
            margin-left: 8px;
            font-weight: 500;
        }
        .empty {
            color: #777;
            text-align: center;
            padding: 40px 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI Playground</h1>
        <p class="subtitle">Wähle eine Datei zum Öffnen</p>
        
        <ul class="file-list">
            <?php
            $files = array_diff(scandir(__DIR__), ['.', '..']);
            $filteredFiles = array_filter($files, function($file) {
                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                return ($ext === 'php' || $ext === 'html') && $file !== 'index.php';
            });
            
            usort($filteredFiles, function($a, $b) {
                return strcasecmp($a, $b);
            });
            
            if (empty($filteredFiles)) {
                echo '<div class="empty">Keine PHP- oder HTML-Dateien gefunden</div>';
            } else {
                foreach ($filteredFiles as $file) {
                    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                    $name = htmlspecialchars($file, ENT_QUOTES, 'UTF-8');
                    echo "<li><a href=\"$name\">$name <span class=\"file-type\">$ext</span></a></li>";
                }
            }
            ?>
        </ul>
    </div>
</body>
</html>
