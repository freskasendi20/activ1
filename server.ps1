# ActivKeyz - Static HTTP Web Server
$ports = @(8090, 8085, 8086)
$listener = $null
$activePort = $null

foreach ($p in $ports) {
    try {
        $testListener = New-Object System.Net.HttpListener
        $testListener.Prefixes.Add("http://localhost:$p/")
        $testListener.Start()
        $listener = $testListener
        $activePort = $p
        break
    } catch {
        # Try next port
    }
}

if (-not $listener) {
    Write-Error "Failed to start listener on any port ($ports)"
    exit 1
}

Write-Host "========================================="
Write-Host " ActivKeyz Server Running Successfully!"
Write-Host " URL: http://localhost:$activePort/index.html"
Write-Host "========================================="

$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
    ".xml"   = "application/xml; charset=utf-8"
    ".txt"   = "text/plain; charset=utf-8"
    ".webp"  = "image/webp"
}

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $baseDir) { $baseDir = (Get-Location).Path }

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $decoded = [System.Uri]::UnescapeDataString($relPath)
        $fullPath = Join-Path $baseDir $decoded

        # Security: Block serving of sensitive files, directories, backups, database migrations, and scripts
        $lowerRel = $decoded.ToLower().Replace("\", "/")
        $fileName = [System.IO.Path]::GetFileName($fullPath).ToLower()
        if ($fileName.StartsWith(".") -or 
            $fileName.EndsWith(".env") -or 
            $fileName.EndsWith(".sql") -or 
            $fileName.EndsWith(".ps1") -or 
            $fileName.EndsWith(".bak") -or 
            $lowerRel.StartsWith("_backup") -or 
            $lowerRel.Contains("/_backup") -or 
            $lowerRel.StartsWith("scratch/") -or 
            $lowerRel.StartsWith("supabase/migrations/")) {
            $response.StatusCode = 403
            $htmlStr = "<html><body style='background:#030712;color:#ef4444;font-family:sans-serif;padding:40px;'><h1>403 Forbidden</h1><p>Access to configuration, backups, and system files is strictly restricted.</p></body></html>"
            $msg = [System.Text.Encoding]::UTF8.GetBytes($htmlStr)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $msg.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
            $response.Close()
            continue
        }

        # Route alias mapping: /admin -> dashboard.html, /dashboard -> dashboard.html
        $cleanPath = $relPath.ToLower().TrimEnd('/')
        if ($cleanPath -eq "admin" -or $cleanPath -eq "admin.html" -or $cleanPath -eq "dashboard") {
            $fullPath = Join-Path $baseDir "dashboard.html"
        }

        if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeTypes.ContainsKey($ext)) {
                $mime = $mimeTypes[$ext]
            }
            
            $response.ContentType = $mime
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache")

            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $response.StatusCode = 404
            $htmlStr = "<html><body style='background:#030712;color:#fff;font-family:sans-serif;padding:40px;'><h1>404 Not Found</h1><p>File: " + $decoded + "</p><a href='/index.html' style='color:#00d2ff;'>Return to Home</a></body></html>"
            $msg = [System.Text.Encoding]::UTF8.GetBytes($htmlStr)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $msg.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
        $response.Close()
    } catch {
        # keep serving
    }
}
