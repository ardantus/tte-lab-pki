# Load .env variables
$ErrorActionPreference = 'Stop'
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

Write-Host "Bootstrapping VendorSign (Intermediate CA)..."

# Ensure directories exist
New-Item -ItemType Directory -Force -Path stepca-vendor/secrets | Out-Null
New-Item -ItemType Directory -Force -Path stepca-vendor/certs | Out-Null
New-Item -ItemType Directory -Force -Path stepca-vendor/config | Out-Null
New-Item -ItemType Directory -Force -Path stepca-vendor/db | Out-Null

# Write password file safely
try {
    if (Test-Path stepca-vendor/secrets/password) { Remove-Item stepca-vendor/secrets/password -Force }
    Set-Content -Path stepca-vendor/secrets/password -Value $env:MINIO_ROOT_PASSWORD -NoNewline -Encoding ASCII
}
catch {
    Write-Warning "Could not write password file: $($_.Exception.Message)"
}

# We need the Root CA running to sign the intermediate
docker compose up -d stepca-root
Write-Host "Waiting for Root CA..."
Start-Sleep -Seconds 5

# Reset Vendor CA if it looks broken (e.g. partial init)
# We will just force re-init if certs are missing, but here we assume clean start or idempotent.
# If ca.json exists but is broken, `step ca init` might fail or skip. 
# Let's check for critical files.

if (!(Test-Path stepca-vendor/config/ca.json)) {
    Write-Host "Initializing VendorSign config..."
    # Ensure password file is accessible inside
    # Flattened command to avoid argument parsing issues + Run as Root (--user 0) to fix permission denied
    docker compose run --rm --entrypoint /bin/sh --user 0 -e DOCKER_STEPCA_INIT_NAME="" stepca-vendor -c "step ca init --name 'VendorSign' --dns 'localhost,stepca-vendor' --address ':9000' --provisioner 'vendor-admin' --password-file /home/step/secrets/password --no-db"
    
    Write-Host "Replacing root cert with RegulatorCA root..."
    Copy-Item stepca-root/certs/root_ca.crt stepca-vendor/certs/root_ca.crt -Force
    
    docker compose run --rm --entrypoint /bin/sh --user 0 -e DOCKER_STEPCA_INIT_NAME="" stepca-vendor -c "step certificate create 'VendorSign' certs/intermediate_ca.csr secrets/intermediate_ca_key --csr --password-file /home/step/secrets/password"
    
    # 2. Sign it with Root CA
    # Fix Docker path for Windows: use explicit logic to resolve absolute path
    $CurrentDir = (Get-Location).Path
    $LocalCertsPath = Join-Path $CurrentDir "stepca-vendor\certs"
    
    # Verify CSR exists
    if (!(Test-Path "$LocalCertsPath\intermediate_ca.csr")) {
        Write-Error "CSR creation failed. Exiting."
        exit 1
    }

    Write-Host "Signing CSR with Root CA (using docker mount: $LocalCertsPath)..."
    
    docker compose run --rm --entrypoint /bin/sh --user 0 -v "${LocalCertsPath}:/vendor_certs" stepca-root -c "step certificate sign /vendor_certs/intermediate_ca.csr /home/step/certs/root_ca.crt /home/step/secrets/root_ca_key --profile intermediate-ca --password-file /home/step/secrets/password" | Out-File -FilePath stepca-vendor/certs/intermediate_ca.crt -Encoding ASCII
        
    if (!(Test-Path stepca-vendor/certs/intermediate_ca.crt)) {
        Write-Error "Failed to sign certificate. intermediate_ca.crt not found."
        exit 1
    }

    Write-Host "VendorSign CA configured with RegulatorCA Root."
    
    Write-Host "Adding 'user-issuer' provisioner..."
    docker compose run --rm --entrypoint /bin/sh --user 0 -e DOCKER_STEPCA_INIT_NAME="" stepca-vendor -c "step ca provisioner add user-issuer --type JWK --create --password-file /home/step/secrets/password"
    
}
else {
    Write-Host "VendorSign already initialized (ca.json exists)."
}

# Fix permissions: Since we ran as root (or might have leftover root files), we must ensure step user owns them.
# The step-ca container runs as 'step' (UID 1000).
Write-Host "Fixing file permissions for 'step' user..."
docker compose run --rm --entrypoint /bin/sh --user 0 -e DOCKER_STEPCA_INIT_NAME="" stepca-vendor -c "chown -R 1000:1000 /home/step/secrets /home/step/certs /home/step/config"

Write-Host "VendorSign bootstrapped."
