FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy workspace configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install dependencies for API and types packages
RUN pnpm install --frozen-lockfile --filter @nexus/types --filter api...

# Copy source trees
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build @nexus/types, generate Prisma Client, and build API TypeScript
RUN pnpm --filter @nexus/types build
RUN cd apps/api && pnpm exec prisma generate
RUN pnpm --filter api build

WORKDIR /app/apps/api

# Create persistent storage folder for uploads
RUN mkdir -p /app/apps/uploads

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

CMD ["node", "dist/server.js"]
