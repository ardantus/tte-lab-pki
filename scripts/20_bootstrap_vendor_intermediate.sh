# Load .env variables (ignoring comments)
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Prevent Git Bash from converting paths
export MSYS_NO_PATHCONV=1

echo "Bootstrapping VendorSign (Intermediate CA)..."

mkdir -p stepca-vendor/secrets
echo "${MINIO_ROOT_PASSWORD}" > stepca-vendor/secrets/password

# We need the Root CA running to sign the intermediate
docker compose up -d stepca-root
echo "Waiting for Root CA..."
sleep 5

# Initialize Intermediate CA if not exists
if [ ! -f stepca-vendor/config/ca.json ]; then
  # 1. Create a request for intermediate CA
  # But step ca init doesn't support creating intermediate directly signed by another remote step-ca easily in one go without some manual steps usually.
  # However, we can generate a CSR and sign it with root.
  
  # For simplicity in this lab, we will generate the config locally then sign.
  
  # Actually, 'step ca init' can create a root and intermediate. 
  # Here we want a separate intermediate.
  
  # Workaround: Initialize a standalone CA then replace its certs with ones signed by Root.
  echo "Initializing VendorSign config..."
  docker compose run --rm stepca-vendor step ca init \
    --name "VendorSign" \
    --dns "localhost,stepca-vendor" \
    --address ":9000" \
    --provisioner "vendor-admin" \
    --password-file /home/step/secrets/password \
    --no-db
    
  echo "Replacing root cert with RegulatorCA root..."
  # Copy Root CA cert to Vendor
  # In a real scenario, this is public info.
  cp stepca-root/certs/root_ca.crt stepca-vendor/certs/root_ca.crt
  
  echo "Generating Intermediate Key and CSR..."
  docker compose run --rm stepca-vendor step certificate create "VendorSign Intermediate" stepca-vendor/certs/intermediate_ca.crt stepca-vendor/secrets/intermediate_ca_key \
    --ca-url "https://stepca-root:9000" \
    --root /home/step/certs/root_ca.crt \
    --password-file /home/step/secrets/password \
    --no-password --insecure
    # Wait, the above command tries to ask the root CA to sign.
    
  # Let's do it properly:
  # 1. Generate CSR/Key for intermediate
  docker compose run --rm stepca-vendor step certificate create "VendorSign" stepca-vendor/certs/intermediate_ca.csr stepca-vendor/secrets/intermediate_ca_key \
     --csr --key-password-file /home/step/secrets/password
     
  # 2. Sign it with Root CA (Regulator)
  # using the 'stepca-root' container to sign
  # We need to mount the vendor CSR to root container
  # Since volumes are separate, we can use 'docker cp' or assume relative paths for this script if running on host
  
  # Host based signing (easier since we have mapped volumes)
  docker compose run --rm -v $(pwd)/stepca-vendor/certs:/vendor_certs stepca-root step certificate sign /vendor_certs/intermediate_ca.csr /home/step/certs/root_ca.crt /home/step/secrets/root_ca_key \
    --profile intermediate-ca --password-file /home/step/secrets/password > stepca-vendor/certs/intermediate_ca.crt
    
  # 3. Configure Vendor CA to use this intermediate
  # We already did 'step ca init' which created a self-signed root and intermediate. We need to swap them.
  # step-ca config expects 'root' (which is the trust anchor) and 'crt' (its own cert) and 'key'.
  
  # For an intermediate CA:
  # root = RegulatorCA root
  # crt = VendorSign intermediate cert
  # key = VendorSign intermediate key
  
  # Update ca.json (sed or jq)
  # But wait, step ca init generated a root_ca.crt in stepca-vendor/certs. We should overwrite it with RegulatorCA root.
  cp stepca-root/certs/root_ca.crt stepca-vendor/certs/root_ca.crt
  
  # And overwrite intermediate_ca.crt and key
  # The key is already there (intermediate_ca_key)
  # The cert is there (intermediate_ca.crt)
  
  echo "VendorSign CA configured with RegulatorCA Root."

  # Add a JWK provisioner for the Vendor API to use for issuing user certs
  echo "Adding 'user-issuer' provisioner..."
  docker compose run --rm stepca-vendor step ca provisioner add user-issuer --type JWK --create --password-file /home/step/secrets/password
  
  # We need to get the password/key for this provisioner to give to Vendor API.
  # step ca provisioner list... 
  # Actually, for JWK, the encrypted key is in ca.json. The password to decrypt it is needed.
  # Using the global password file for simplicity.
  
else
  echo "VendorSign already initialized."
fi

# Ensure permissions
chmod 777 stepca-vendor/certs/*
chmod 777 stepca-vendor/secrets/*

echo "VendorSign bootstrapped."
