# Stage 1: Build React frontend
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --build-from-source && apk del python3 make g++

COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

RUN mkdir -p /data/uploads

EXPOSE 3000
ENV NODE_ENV=production
ENV DB_PATH=/data/mailswitch.db
ENV UPLOAD_DIR=/data/uploads

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "index.js"]
