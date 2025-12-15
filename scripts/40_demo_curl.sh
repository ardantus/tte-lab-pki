#!/bin/bash
set -e

API_URL="http://localhost:8080"
echo "Starting Demo Flow..."

# 1. Login Admin
echo "1. Login Admin..."
TOKEN_ADMIN=$(curl -s -X POST $API_URL/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vendorsign.local","password":"admin"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN_ADMIN" ]; then echo "Login failed"; exit 1; fi
echo "Admin Token obtained."

# 2. Get Pending Users
echo "2. Checking Pending Users..."
PENDING=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$API_URL/admin/users?status=PENDING" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -n 1)

if [ -z "$PENDING" ]; then
    echo "No pending users found (maybe already verified?)."
else
    echo "Found Pending User ID: $PENDING"
    echo "3. Verifying User..."
    curl -s -X POST -H "Authorization: Bearer $TOKEN_ADMIN" "$API_URL/admin/users/$PENDING/verify"
    echo "User verified."
fi

# 3. Login Client A
echo "4. Login Client A..."
TOKEN_USER=$(curl -s -X POST $API_URL/auth/login -H "Content-Type: application/json" -d '{"email":"clienta@lab.local","password":"password"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "User Token obtained."

# 4. Request Certificate
echo "5. Requesting Certificate..."
SERIAL=$(curl -s -X POST -H "Authorization: Bearer $TOKEN_USER" $API_URL/cert/request | grep -o '"serial":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SERIAL" ]; then 
    echo "Certificate request failed or already issued. Checking /me..."
    SERIAL=$(curl -s -H "Authorization: Bearer $TOKEN_USER" $API_URL/cert/me | grep -o '"serial":"[^"]*"' | cut -d'"' -f4)
fi
echo "Certificate Serial: $SERIAL"

# 5. Upload PDF
echo "6. Uploading PDF..."
# Create dummy PDF if not exists
if [ ! -f samples/sample.pdf ]; then
    mkdir -p samples
    echo "PDF Content" > samples/sample.pdf # Invalid PDF but uploaded as bytes
fi

# We need a real PDF for the worker to parse.
# Download a minimal PDF or skip worker success check.
# The worker uses pdf-lib which needs valid PDF.
# Let's trust the user has put one or download one.
if [ ! -s samples/sample.pdf ]; then
    curl -s -o samples/sample.pdf https://pdf-lib.js.org/assets/with_update_sections.pdf || echo "Dummy" > samples/sample.pdf
fi

DOC_ID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN_USER" -F "file=@samples/sample.pdf" $API_URL/docs/upload | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Document ID: $DOC_ID"

# 6. Sign Document
echo "7. Signing Document (Page 1, 100, 100)..."
curl -s -X POST -H "Authorization: Bearer $TOKEN_USER" -H "Content-Type: application/json" \
    -d '{"page":1, "x":100, "y":100, "width":200, "height":50, "reason":"Demo Script Sign"}' \
    "$API_URL/docs/$DOC_ID/sign"

echo "Signing queued. Waiting 5s..."
sleep 5

# 7. Check Status
echo "8. Checking Status..."
STATUS=$(curl -s -H "Authorization: Bearer $TOKEN_USER" $API_URL/docs | grep -o '"status":"[^"]*"' | head -n 1)
echo "Status: $STATUS"

# 8. Download
if [[ "$STATUS" == *"SIGNED"* ]]; then
    echo "9. Downloading Signed PDF..."
    curl -s -H "Authorization: Bearer $TOKEN_USER" "$API_URL/docs/$DOC_ID/download" -o samples/signed_output.pdf
    echo "Downloaded to samples/signed_output.pdf"
else
    echo "Document not yet signed. Worker might be slow or failed."
fi

echo "Demo Finished."
