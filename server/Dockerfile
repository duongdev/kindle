# Chromium and its system libraries come from the Playwright image; keep its tag equal to playwright-core.
FROM mcr.microsoft.com/playwright:v1.65.1-noble
WORKDIR /app
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY tsconfig.json config.example.json ./
COPY src ./src
ENV NODE_ENV=production PORT=8080 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
EXPOSE 8080
USER pwuser
CMD ["node_modules/.bin/tsx", "src/server.ts"]
