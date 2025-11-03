FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
EXPOSE 5173
CMD ["npm", "run", "dev"]
