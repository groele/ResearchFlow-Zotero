param([switch]$Browser)
$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path $PSScriptRoot -Parent
Push-Location $workspaceRoot
try {
  $testFiles = Get-ChildItem -LiteralPath $PSScriptRoot -Filter *.test.js | Sort-Object Name
  if (-not $testFiles) { throw 'No regression tests found.' }
  foreach ($file in $testFiles) {
    & node $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Regression failed: $($file.Name)" }
  }
  foreach ($file in (Get-ChildItem scripts -Recurse -Filter *.js)) {
    & node --check $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax failed: $($file.Name)" }
  }
  if ($Browser) {
    & node tests/extension-browser-smoke.js
    if ($LASTEXITCODE -ne 0) { throw 'Real extension browser smoke failed.' }
    & node tests/share-card-browser-smoke.js
    if ($LASTEXITCODE -ne 0) { throw 'Share card browser smoke failed.' }
    $server = Start-Process -FilePath node -ArgumentList 'tests/static-server.js' -WorkingDirectory $workspaceRoot -PassThru -WindowStyle Hidden
    try {
      Start-Sleep -Milliseconds 600
      & node tests/workspace-browser-smoke.js
      if ($LASTEXITCODE -ne 0) { throw 'Mocked workspace browser smoke failed.' }
    } finally {
      Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Output 'ResearchFlow verification passed.'
} finally { Pop-Location }
