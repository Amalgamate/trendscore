# Build stage
FROM node:20-alpine AS builder

ARG BUILD_SHA=dev
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN echo "frontend build ${BUILD_SHA}" && npm run build

# Production stage
FROM nginx:stable-alpine

COPY --from=builder /app/build /usr/share/nginx/html

# Custom nginx config to handle React Router
RUN printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    location / {' \
    '        root /usr/share/nginx/html;' \
    '        index index.html index.htm;' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '    location /api {' \
    '        proxy_pass http://backend:5000/api;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
