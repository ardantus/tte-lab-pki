#!/bin/bash
set -e
# Prevent Git Bash from converting paths (e.g. /home/step/...) to Windows paths
export MSYS_NO_PATHCONV=1

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Bootstrapping RegulatorCA (Root)..."

mkdir -p stepca-root/secrets
echo "${MINIO_ROOT_PASSWORD}" > stepca-root/secrets/password

# Initialize Root CA if not exists
if [ ! -f stepca-root/config/ca.json ]; then
  docker compose run --rm stepca-root step ca init \
    --name "RegulatorCA" \
    --dns "localhost,stepca-root" \
    --address ":9000" \
    --provisioner "regulator-admin" \
    --password-file /home/step/secrets/password \
    --with-ca-url "https://localhost:9000" \
    --no-db
else
  echo "RegulatorCA already initialized."
fi

# Retrieve Root Fingerprint
ROOT_FINGERPRINT=$(docker compose run --rm stepca-root step certificate fingerprint /home/step/certs/root_ca.crt)
echo "Root Fingerprint: $ROOT_FINGERPRINT"

# Add fingerprint to .env if missing
if ! grep -q "STEP_CA_FINGERPRINT=" .env; then
  echo "STEP_CA_FINGERPRINT=$ROOT_FINGERPRINT" >> .env
else
  sed -i "s/STEP_CA_FINGERPRINT=.*/STEP_CA_FINGERPRINT=$ROOT_FINGERPRINT/" .env
fi

echo "RegulatorCA bootstrapped."
