FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install
COPY tsconfig.json ./
COPY src ./src
EXPOSE 4000
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]
