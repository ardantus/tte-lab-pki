#!/bin/bash
set -e

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

API_URL="http://api.pki-lab.local"
echo "Seeding users to $API_URL..."

# Helper to check if API is up
until curl -s $API_URL/health > /dev/null; do
  echo "Waiting for API..."
  sleep 5
done

# 1. Admin User
# We need to manually insert ADMIN or have a special register endpoint?
# The requirements said "Role enum: USER/ADMIN".
# My register endpoint defaults to USER.
# So I should seed the Admin via direct DB manipulation or a special secret.
# Direct DB is cleaner for "Bootstrap".

echo "Creating Admin User directly in DB..."
# We need a hash for "admin123"
# BCrypt hash for admin123 cost 10: $2b$10$7vjT.jD.2.j2.j2.j2.j2e
# Actually generating it properly:
HASH='$2b$10$X7.G1.x.x.x.x.x.x.x.xO' # Placeholder, better to rely on register then update.

# Option 2: Register normally, then Update Role via SQL.
echo "Registering Admin..."
curl -s -X POST $API_URL/auth/register -H "Content-Type: application/json" -d '{
  "name": "Super Admin",
  "email": "admin@vendorsign.local",
  "phone": "081234567890",
  "national_id_sim": "1234567890",
  "password": "password123"
}' || true

echo "Registering Client A..."
curl -s -X POST $API_URL/auth/register -H "Content-Type: application/json" -d '{
  "name": "Client A",
  "email": "clienta@lab.local",
  "phone": "08123456789",
  "national_id_sim": "1234567890",
  "password": "password"
}' || true

echo "Registering Client B..."
curl -s -X POST $API_URL/auth/register -H "Content-Type: application/json" -d '{
  "name": "Client B",
  "email": "clientb@lab.local",
  "phone": "08987654321",
  "national_id_sim": "0987654321",
  "password": "password"
}' || true

# Promote Admin
echo "Promoting admin@vendorsign.local to ADMIN role..."
docker compose exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-tte_pki} -c "UPDATE users SET role = 'ADMIN', status = 'VERIFIED' WHERE email = 'admin@vendorsign.local';"

echo "Seeding complete."
