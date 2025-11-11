FROM node:20-alpine

WORKDIR /app

# Copy only the backend package files
COPY services/api/package.json services/api/package-lock.json* ./

# Install dependencies
RUN npm ci --no-audit --no-fund || npm install

# Copy backend configuration and source files
COPY services/api/tsconfig.json ./
COPY services/api/src ./src

# Expose your app port
EXPOSE 4000

# Start the server
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]
