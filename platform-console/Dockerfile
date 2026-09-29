FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache bash jq docker-cli docker-cli-compose curl openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY auth-config.js billing-store.js billing-documents.js users-store.js tenants-store.js server.js ./
COPY scripts/provision-instance.sh ./scripts/provision-instance.sh
COPY public/ ./public/
COPY deploy/deploy-release.sh ./deploy/deploy-release.sh
COPY deploy/instances.manifest.json ./deploy/instances.manifest.json
RUN chmod +x ./deploy/deploy-release.sh ./scripts/provision-instance.sh

EXPOSE 3100

CMD ["node", "--experimental-sqlite", "server.js"]
