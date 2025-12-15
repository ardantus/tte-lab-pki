
$ErrorActionPreference = 'Stop'
$API_URL = "http://localhost:8080"
Write-Host "Seeding users to $API_URL..."

# Helper to check if API is up
do {
    try {
        $res = Invoke-RestMethod -Uri "$API_URL/health" -Method Get -ErrorAction Stop
        $up = $true
    }
    catch {
        Write-Host "Waiting for API..."
        Start-Sleep -Seconds 5
        $up = $false
    }
} until ($up)

Write-Host "Registering Admin..."
try {
    Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -ContentType "application/json" -Body '{
      "name": "Super Admin",
      "email": "admin@vendorsign.local",
      "phone": "00000000",
      "national_id_sim": "000",
      "password": "admin"
    }'
}
catch {
    Write-Host "Admin register skipped/failed: $($_.Exception.Message)"
}

Write-Host "Registering Client A..."
try {
    Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -ContentType "application/json" -Body '{
      "name": "Client A",
      "email": "clienta@lab.local",
      "phone": "08123456789",
      "national_id_sim": "1234567890",
      "password": "password"
    }'
}
catch { Write-Host "Skipped" }

Write-Host "Registering Client B..."
try {
    Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -ContentType "application/json" -Body '{
      "name": "Client B",
      "email": "clientb@lab.local",
      "phone": "08987654321",
      "national_id_sim": "0987654321",
      "password": "password"
    }'
}
catch { Write-Host "Skipped" }

# Promote Admin
Write-Host "Promoting admin@vendorsign.local to ADMIN role..."
# Load env to get DB params if needed, or use default from compose
docker compose exec postgres psql -U postgres -d tte_pki -c "UPDATE users SET role = 'ADMIN', status = 'VERIFIED' WHERE email = 'admin@vendorsign.local';"

Write-Host "Seeding complete."
