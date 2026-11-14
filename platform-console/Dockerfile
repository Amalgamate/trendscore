FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache bash jq docker-cli docker-cli-compose curl openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY *.js ./
COPY services/ ./services/
COPY public/ ./public/
COPY data/ ./data/
COPY deploy/deploy-release.sh ./deploy/deploy-release.sh
COPY deploy/instances.manifest.json ./deploy/instances.manifest.json
COPY scripts/provision-instance.sh ./scripts/provision-instance.sh
RUN chmod +x ./deploy/deploy-release.sh ./scripts/provision-instance.sh

EXPOSE 3100

CMD ["node", "--experimental-sqlite", "server.js"]
