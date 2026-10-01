# Serves the STAC site locally and opens the Site Readiness tool.
# Paths are matched case-sensitively, like most real web hosts, so a
# "Logo.png" vs "logo.png" mistake shows up here instead of after launch.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8080] [-NoOpen]
param([int]$Port = 8080, [switch]$NoOpen)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'; '.json' = 'application/json'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
  '.xml' = 'application/xml'; '.pdf' = 'application/pdf'
}

function Resolve-Exact([string]$rel) {
  $cur = $root
  $mismatch = $false
  foreach ($seg in ($rel -split '/') | Where-Object { $_ -ne '' }) {
    if ($seg -eq '..' -or $seg -eq '.') { return $null }
    if (-not (Test-Path -LiteralPath $cur -PathType Container)) { return $null }
    $items = @(Get-ChildItem -LiteralPath $cur -Force)
    $hit = $items | Where-Object { $_.Name -ceq $seg } | Select-Object -First 1
    if (-not $hit) {
      $hit = $items | Where-Object { $_.Name -eq $seg } | Select-Object -First 1
      if (-not $hit) { return $null }
      $mismatch = $true
    }
    $cur = $hit.FullName
  }
  [pscustomobject]@{ Path = $cur; CaseMismatch = $mismatch }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
$toolUrl = "http://localhost:$Port/tools/readiness.html"
Write-Host "STAC site running at http://localhost:$Port/"
Write-Host "Readiness tool:      $toolUrl"
Write-Host "Press Ctrl+C to stop."
if (-not $NoOpen) { Start-Process $toolUrl }

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(500)) { }
    $ctx = $task.GetAwaiter().GetResult()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($rel.EndsWith('/')) { $rel += 'index.html' }
      $hit = Resolve-Exact $rel
      if ($hit -and -not $hit.CaseMismatch -and (Test-Path -LiteralPath $hit.Path -PathType Container)) {
        $hit = Resolve-Exact ($rel.TrimEnd('/') + '/index.html')
      }
      $res.Headers.Add('Cache-Control', 'no-store')
      if (-not $hit -or $hit.CaseMismatch) {
        $res.StatusCode = 404
        if ($hit) {
          $actual = $hit.Path.Substring($root.Length).Replace('\', '/')
          $res.Headers.Add('X-Case-Mismatch', $actual)
        }
        # Serve the site's own 404 page, the way most hosts do.
        $notFound = Join-Path $root '404.html'
        if (Test-Path -LiteralPath $notFound) {
          $bytes = [IO.File]::ReadAllBytes($notFound)
          $res.ContentType = 'text/html; charset=utf-8'
        } else {
          $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
          $res.ContentType = 'text/plain; charset=utf-8'
        }
      } else {
        $ext = [IO.Path]::GetExtension($hit.Path).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($hit.Path)
      }
      $res.ContentLength64 = $bytes.Length
      if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      Write-Host ("{0} {1} {2}" -f $res.StatusCode, $req.HttpMethod, $req.Url.AbsolutePath)
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
