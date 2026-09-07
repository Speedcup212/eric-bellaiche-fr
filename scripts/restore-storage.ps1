param(
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [Parameter(Mandatory=$true)][string]$TargetEndpoint,
  [Parameter(Mandatory=$true)][string]$TargetRegion,
  [Parameter(Mandatory=$true)][ValidateSet("RESTORE_TO_ISOLATED_PROJECT")][string]$SafetyConfirmation
)

$ErrorActionPreference = "Stop"

# This script is deliberately designed for an isolated recovery project.
# It never deletes destination objects and refuses to run without the explicit
# safety confirmation above.
# Required environment variables:
#   TARGET_S3_ACCESS_KEY
#   TARGET_S3_SECRET_KEY

if ($SafetyConfirmation -ne "RESTORE_TO_ISOLATED_PROJECT") {
  throw "Restauration refusée : utilisez uniquement un projet isolé."
}

if (-not (Test-Path $BackupDirectory)) {
  throw "Répertoire de sauvegarde introuvable."
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI est requis."
}

$accessKey = $env:TARGET_S3_ACCESS_KEY
$secretKey = $env:TARGET_S3_SECRET_KEY
if (-not $accessKey -or -not $secretKey) {
  throw "Variables TARGET_S3_ACCESS_KEY et TARGET_S3_SECRET_KEY requises."
}

$manifest = Join-Path $BackupDirectory "SHA256SUMS.txt"
if (-not (Test-Path $manifest)) {
  throw "Manifest SHA256 absent : sauvegarde non vérifiable."
}

$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey
$env:AWS_DEFAULT_REGION = $TargetRegion

$buckets = @("client-source-docs", "regulatory-docs")
foreach ($bucket in $buckets) {
  $source = Join-Path $BackupDirectory $bucket
  if (-not (Test-Path $source)) {
    throw "Bucket sauvegardé absent : $bucket"
  }

  Write-Host "Restauration de $bucket vers le projet ISOLE"
  aws s3 sync $source "s3://$bucket" --endpoint-url $TargetEndpoint --region $TargetRegion --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Echec restauration $bucket" }
}

Write-Host "Copie Storage terminée. Vérifiez ensuite manuellement :"
Write-Host "1. le nombre d'objets par bucket ;"
Write-Host "2. l'ouverture d'un échantillon de documents ;"
Write-Host "3. les politiques RLS et la confidentialité des buckets ;"
Write-Host "4. l'absence d'appel réseau indésirable depuis le projet restauré."
