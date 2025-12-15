$API_URL = "http://localhost"
Write-Host "Starting Demo Flow..."

# 1. Login Admin
Write-Host "1. Login Admin..."
try {
    $adminLogin = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@vendorsign.local","password":"admin"}'
    $TOKEN_ADMIN = $adminLogin.token
    Write-Host "Admin Token obtained."
}
catch {
    Write-Error "Login failed: $($_.Exception.Message)"
    exit 1
}

# 2. Get Pending Users
Write-Host "2. Checking Pending Users..."
$pendingUsers = Invoke-RestMethod -Uri "$API_URL/admin/users?status=PENDING" -Method Get -Headers @{ Authorization = "Bearer $TOKEN_ADMIN" }

if ($pendingUsers.Count -eq 0) {
    Write-Host "No pending users found (maybe already verified?)."
}
else {
    $targetUser = $pendingUsers[0]
    Write-Host "Found Pending User ID: $($targetUser.id)"
    Write-Host "3. Verifying User..."
    Invoke-RestMethod -Uri "$API_URL/admin/users/$($targetUser.id)/verify" -Method Post -Headers @{ Authorization = "Bearer $TOKEN_ADMIN" }
    Write-Host "User verified."
}

# 3. Login Client A
Write-Host "4. Login Client A..."
$userLogin = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"clienta@lab.local","password":"password"}'
$TOKEN_USER = $userLogin.token
Write-Host "User Token obtained."

# 4. Request Certificate
Write-Host "5. Requesting Certificate..."
try {
    $certReq = Invoke-RestMethod -Uri "$API_URL/cert/request" -Method Post -Headers @{ Authorization = "Bearer $TOKEN_USER" }
    $SERIAL = $certReq.serial
}
catch {
    # Check if existing
    $me = Invoke-RestMethod -Uri "$API_URL/cert/me" -Method Get -Headers @{ Authorization = "Bearer $TOKEN_USER" }
    $SERIAL = $me.serial
}
Write-Host "Certificate Serial: $SERIAL"

# 5. Upload PDF
Write-Host "6. Uploading PDF..."
if (!(Test-Path samples)) { New-Item -ItemType Directory -Path samples | Out-Null }
if (!(Test-Path samples/sample.pdf)) { Set-Content samples/sample.pdf -Value "Dummy PDF Content" }

# Download real PDF if dummy
if ((Get-Item samples/sample.pdf).Length -lt 100) {
    try {
        Invoke-WebRequest -Uri "https://pdf-lib.js.org/assets/with_update_sections.pdf" -OutFile samples/sample.pdf
    }
    catch {
        Write-Host "Failed to download sample PDF, using dummy."
    }
}

# Upload Multipart is tricky in pure Invoke-RestMethod < PS 7.
# We will use curl if available (Windows usually has curl alias to Invoke-WebRequest, but often real curl is installed too).
# If correct curl is available (curl.exe), use it.
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    $uploadJson = curl.exe -s -X POST -H "Authorization: Bearer $TOKEN_USER" -F "file=@samples/sample.pdf" "$API_URL/documents/upload"
    $DOC_ID = ($uploadJson | ConvertFrom-Json).id
}
else {
    Write-Warning "curl.exe not found. Skipping file upload step in PS script (Multipart POST is hard in legacy PS)."
    exit
}

Write-Host "Document ID: $DOC_ID"

# 6. Sign Document
Write-Host "7. Signing Document..."
$signBody = @{
    page   = 1
    x      = 100
    y      = 100
    width  = 200
    height = 50
    reason = "Demo Script Sign"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$API_URL/documents/$DOC_ID/sign" -Method Post -Headers @{ Authorization = "Bearer $TOKEN_USER" } -ContentType "application/json" -Body $signBody
Write-Host "Signing queued. Waiting 5s..."
Start-Sleep -Seconds 5

# 7. Check Status
Write-Host "8. Checking Status..."
$docs = Invoke-RestMethod -Uri "$API_URL/documents" -Method Get -Headers @{ Authorization = "Bearer $TOKEN_USER" }
$myDoc = $docs | Where-Object { $_.id -eq $DOC_ID }
Write-Host "Status: $($myDoc.status)"

# 8. Download
if ($myDoc.status -eq "SIGNED") {
    Write-Host "9. Downloading Signed PDF..."
    Invoke-WebRequest -Uri "$API_URL/documents/$DOC_ID/download" -Headers @{ Authorization = "Bearer $TOKEN_USER" } -OutFile samples/signed_output.pdf
    Write-Host "Downloaded to samples/signed_output.pdf"
}
else {
    Write-Host "Document not signed yet."
}

Write-Host "Demo Finished."
