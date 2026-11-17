# Node slim plus only Chromium's headless shell (fonts are inlined in the page; no system fonts needed).
FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN node_modules/.bin/playwright-core install --with-deps chromium-headless-shell \
  && rm -rf /var/lib/apt/lists/*
COPY tsconfig.json config.example.json ./
COPY src ./src
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node_modules/.bin/tsx", "src/server.ts"]
