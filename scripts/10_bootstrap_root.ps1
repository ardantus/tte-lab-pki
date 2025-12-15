# Load .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

Write-Host "Bootstrapping RegulatorCA (Root)..."

New-Item -ItemType Directory -Force -Path stepca-root/secrets | Out-Null
Set-Content -Path stepca-root/secrets/password -Value $env:MINIO_ROOT_PASSWORD -NoNewline

if (!(Test-Path stepca-root/config/ca.json)) {
    docker compose run --rm stepca-root step ca init `
        --name "RegulatorCA" `
        --dns "localhost,stepca-root" `
        --address ":9000" `
        --provisioner "regulator-admin" `
        --password-file /home/step/secrets/password `
        --with-ca-url "https://localhost:9000" `
        --no-db
}
else {
    Write-Host "RegulatorCA already initialized."
}

$ROOT_FINGERPRINT = docker compose run --rm stepca-root step certificate fingerprint /home/step/certs/root_ca.crt # Prevent Git Bash from converting paths (e.g. /home/step/...) to Windows paths
$ErrorActionPreference = 'Stop'
$env:MSYS_NO_PATHCONV = 1
# Clean up output if needed (trim whitespace)
$ROOT_FINGERPRINT = $ROOT_FINGERPRINT.Trim()
Write-Host "Root Fingerprint: $ROOT_FINGERPRINT"

# Update .env
$envContent = Get-Content .env
if ($envContent -match "STEP_CA_FINGERPRINT=") {
    $envContent = $envContent -replace "STEP_CA_FINGERPRINT=.*", "STEP_CA_FINGERPRINT=$ROOT_FINGERPRINT"
}
else {
    $envContent += "STEP_CA_FINGERPRINT=$ROOT_FINGERPRINT"
}
$envContent | Set-Content .env

Write-Host "RegulatorCA bootstrapped."
