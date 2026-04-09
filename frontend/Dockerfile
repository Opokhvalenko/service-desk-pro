# syntax=docker/dockerfile:1.6

# ─── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install deps with deterministic lockfile
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build a production bundle
COPY . .
RUN npm run build

# ─── Stage 2: runtime (nginx) ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# SPA-friendly nginx config: gzip, long-cache for hashed assets,
# no-cache for index.html, fallback to index.html for client-side routes
COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
  listen       80;
  server_name  _;
  root         /usr/share/nginx/html;
  index        index.html;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  # Hashed bundles can be cached aggressively
  location ~* \.(?:js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|webp|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  # index.html should never be cached so SW updates land
  location = /index.html {
    add_header Cache-Control "no-store";
    try_files $uri =404;
  }

  # SPA fallback for client-side routes
  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
