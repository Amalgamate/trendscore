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
    '    gzip on;' \
    '    gzip_comp_level 5;' \
    '    gzip_min_length 1024;' \
    '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss image/svg+xml;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html index.htm;' \
    '    location /assets/ {' \
    '        try_files $uri =404;' \
    '        add_header Cache-Control "public, max-age=31536000, immutable" always;' \
    '    }' \
    '    location = /index.html {' \
    '        add_header Cache-Control "no-cache, no-store, must-revalidate" always;' \
    '    }' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '        add_header Cache-Control "no-cache" always;' \
    '    }' \
    '    location /api {' \
    '        proxy_pass http://backend:5000/api;' \
    '        proxy_http_version 1.1;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
    '        proxy_set_header X-Forwarded-Proto $scheme;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
