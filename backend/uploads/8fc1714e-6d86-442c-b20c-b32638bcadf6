# --------- Build Stage ---------
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build the frontend
COPY . .
RUN npm run build

# --------- Production Stage ---------
# Use nginx to serve the static built files
FROM nginx:alpine AS production

# Copy the built Vite output from /app/dist to nginx html dir
COPY --from=builder /app/dist /usr/share/nginx/html

# Add a custom nginx configuration for React Router (SPA fallback)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
