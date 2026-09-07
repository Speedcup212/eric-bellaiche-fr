param(
  [Parameter(Mandatory=$true)][string]$Destination,
  [string]$Region = "eu-west-3"
)

$ErrorActionPreference = "Stop"

# Credentials are intentionally NOT stored in this file.
# Required environment variables:
#   SUPABASE_S3_ENDPOINT
#   SUPABASE_S3_ACCESS_KEY
#   SUPABASE_S3_SECRET_KEY
#
# Example endpoint format is obtained from Supabase > Storage > Configuration > S3.

$endpoint = $env:SUPABASE_S3_ENDPOINT
$accessKey = $env:SUPABASE_S3_ACCESS_KEY
$secretKey = $env:SUPABASE_S3_SECRET_KEY

if (-not $endpoint -or -not $accessKey -or -not $secretKey) {
  throw "Variables SUPABASE_S3_ENDPOINT, SUPABASE_S3_ACCESS_KEY et SUPABASE_S3_SECRET_KEY requises."
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI est requis. Installez-le puis relancez le script."
}

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$root = Join-Path $Destination $stamp
New-Item -ItemType Directory -Path $root -Force | Out-Null

$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey
$env:AWS_DEFAULT_REGION = $Region

$buckets = @("client-source-docs", "regulatory-docs")

foreach ($bucket in $buckets) {
  $target = Join-Path $root $bucket
  New-Item -ItemType Directory -Path $target -Force | Out-Null

  Write-Host "Sauvegarde de $bucket vers $target"
  aws s3 sync "s3://$bucket" $target --endpoint-url $endpoint --region $Region --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Echec de la sauvegarde du bucket $bucket" }
}

$manifest = Join-Path $root "SHA256SUMS.txt"
Get-ChildItem -Path $root -Recurse -File |
  Where-Object { $_.FullName -ne $manifest } |
  Sort-Object FullName |
  ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash.ToLowerInvariant()
    $relative = $_.FullName.Substring($root.Length).TrimStart('\')
    "$hash  $relative"
  } | Set-Content -Encoding UTF8 $manifest

$summary = @{
  created_at = (Get-Date).ToString("o")
  buckets = $buckets
  files = (Get-ChildItem -Path $root -Recurse -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" }).Count
  manifest = "SHA256SUMS.txt"
} | ConvertTo-Json -Depth 3

$summary | Set-Content -Encoding UTF8 (Join-Path $root "backup-summary.json")
Write-Host "Sauvegarde terminée : $root"
Write-Host "Conservez ce répertoire sur un support chiffré distinct de Supabase."
