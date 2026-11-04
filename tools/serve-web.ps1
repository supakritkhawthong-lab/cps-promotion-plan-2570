# tools/serve-web.ps1
# Minimal static file server for local preview of web/ on Windows (no Node required).
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-web.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-web.ps1 -Port 8787
# Then open http://127.0.0.1:8787/index.html
#
# Note: opening web/index.html via file:// does not work, because the page
# loads config.js and fetches the Apps Script API by relative/remote URL.

param(
  [string]$Root = (Join-Path $PSScriptRoot '..\web'),
  [int]$Port = 8787
)

$Root = [System.IO.Path]::GetFullPath((Resolve-Path $Root).Path)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Output "serving $Root on http://127.0.0.1:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = $req.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $resolved = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))

    if (-not $resolved.StartsWith($Root)) {
      $res.StatusCode = 403
    } elseif (Test-Path -LiteralPath $resolved -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      $ext = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
