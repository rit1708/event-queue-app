FROM node:20-alpine

WORKDIR /app

# Copy only the admin package files
COPY apps/admin/package.json apps/admin/package-lock.json* ./

# Install dependencies
RUN npm ci --no-audit --no-fund || npm install

# Copy configuration and source files
COPY apps/admin/tsconfig.json apps/admin/tsconfig.base.json apps/admin/vite.config.ts apps/admin/index.html ./
COPY apps/admin/src ./src

# Expose Vite default port
EXPOSE 5173

# Start the Vite dev server
CMD ["npm", "run", "dev"]
