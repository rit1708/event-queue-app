FROM node:20-alpine

WORKDIR /app

# Copy only the backend package files
COPY services/api/package.json services/api/package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev

# Copy backend configuration and source files
COPY services/api/tsconfig.json ./
COPY services/api/src ./src

# Build TypeScript
RUN npm run build || (npm install -D typescript && npm run build)

# Expose your app port
EXPOSE 4000

# Start the server
CMD ["node", "dist/index.js"]
