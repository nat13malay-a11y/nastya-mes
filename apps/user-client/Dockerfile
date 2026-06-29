FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/mini-app/package.json apps/mini-app/package.json
COPY apps/user-client/package.json apps/user-client/package.json

RUN npm ci

COPY apps/user-client apps/user-client
RUN npm run build -w @nastya-mes/user-client
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/user-client/package.json apps/user-client/package.json
COPY --from=build /app/apps/user-client/dist apps/user-client/dist

CMD ["npm", "run", "start", "-w", "@nastya-mes/user-client"]
