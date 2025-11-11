FROM node:20-alpine

WORKDIR /app

# Copy only client package files
COPY apps/client/package.json apps/client/package-lock.json* ./

# Install dependencies
RUN npm ci --no-audit --no-fund || npm install

# Copy configuration and source files for the client
COPY apps/client/tsconfig.json apps/client/tsconfig.base.json apps/client/vite.config.ts apps/client/index.html ./
COPY apps/client/src ./src

# Expose Vite default port
EXPOSE 5173

# Start the Vite dev server
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]
