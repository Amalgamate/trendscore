# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
# The backend TypeScript project exceeds Node's default 2 GB heap in BuildKit.
RUN npm run prisma:generate && node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
      dumb-init \
      openssl \
      ca-certificates

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# One-shot maintenance scripts (merge-duplicate-parents, diagnose-*, etc.)
COPY --from=builder /app/scripts ./scripts

EXPOSE 5000

# Use dumb-init to properly handle signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
