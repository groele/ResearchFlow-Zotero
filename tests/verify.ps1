$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path $PSScriptRoot -Parent
Push-Location $workspaceRoot
try {
  & node scripts/build-zotero.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Zotero package build failed.' }
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
  Write-Output 'ResearchFlow Zotero verification passed.'
} finally { Pop-Location }
