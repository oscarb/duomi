FROM node:20-alpine AS builder
# Install build essentials for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Copy node_modules with pre-compiled native binaries and build dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/lib/server/db/migrations ./src/lib/server/db/migrations

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=/app/data/duomi.db

# Ensure the database data directory exists
RUN mkdir -p /app/data

# Run Drizzle migrations and start the standalone SvelteKit node server
CMD ["sh", "-c", "npx drizzle-kit migrate && node build"]
