FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache curl openssl

# Install step-cli via GitHub Release (Reliable) and OpenSSL for Prisma
RUN apk add --no-cache curl openssl \
    && curl -LO https://github.com/smallstep/cli/releases/download/v0.24.4/step_linux_0.24.4_amd64.tar.gz \
    && tar -xf step_linux_0.24.4_amd64.tar.gz \
    && mv step_0.24.4/bin/step /usr/local/bin/ \
    && rm -rf step_linux_0.24.4_amd64.tar.gz step_0.24.4

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
