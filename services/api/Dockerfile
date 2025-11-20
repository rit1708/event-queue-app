FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests (build context is services/api)
COPY package.json package-lock.json* ./

# Install all deps including dev for building
RUN npm ci --no-audit --no-fund

# Copy source
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Install only prod deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

