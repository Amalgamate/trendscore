FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache bash jq docker-cli docker-cli-compose curl openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY auth-config.js server.js ./
COPY index.html styles.css kanban-crm.css app.js login.css login.js ./
COPY deploy/deploy-release.sh ./deploy/deploy-release.sh
COPY deploy/instances.manifest.json ./deploy/instances.manifest.json
RUN chmod +x ./deploy/deploy-release.sh

EXPOSE 3100

CMD ["node", "server.js"]
