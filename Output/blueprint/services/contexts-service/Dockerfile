# Multi-stage Dockerfile for contexts-service
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER appuser
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
