FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma Client (needs generic schema if we want to share, but creating a copy or symlink is typical)
# We need to copy the schema from vendor-api or have it in package.
# Simpler: Copy it in Docker build from context relative path? Context is ./vendor-worker usually.
# So we need to put the schema in vendor-worker too.
# I will copy schema.prisma to vendor-worker folder now.

RUN npx prisma generate
RUN npm run build

CMD ["npm", "start"]
