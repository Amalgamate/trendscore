FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache bash jq docker-cli docker-cli-compose curl openssl

COPY platform-console/package*.json ./
RUN npm ci --omit=dev

COPY platform-console/auth-config.js platform-console/server.js ./
COPY platform-console/index.html platform-console/styles.css platform-console/kanban-crm.css platform-console/app.js platform-console/login.css platform-console/login.js ./
COPY scripts/deploy-release.sh ./deploy/deploy-release.sh
COPY deploy/instances.manifest.json ./deploy/instances.manifest.json
RUN chmod +x ./deploy/deploy-release.sh

EXPOSE 3100

CMD ["node", "server.js"]
