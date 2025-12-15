Write-Host "Checking prerequisites..."

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Error: docker is not installed."
    exit 1
}

if (!(Test-Path .env)) {
    Write-Error "Error: .env file not found. Please copy .env.example to .env"
    exit 1
}

Write-Host "Environment looks good."
