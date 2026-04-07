# --------- Build Stage ---------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install exact dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate prisma client & build backend
RUN npx prisma generate
RUN npm run build

# --------- Production Stage ---------
FROM node:18-alpine AS production

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npm run start"]
