# Đa tầng: build và runtime
FROM node:20 AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Runtime: Node + Python + ffmpeg
FROM node:20-slim
WORKDIR /app
# Cài Python3, pip, ffmpeg
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    rm -rf /var/lib/apt/lists/*
# Cài edge-tts
RUN pip3 install --break-system-packages edge-tts
# Copy toàn bộ build output từ builder
COPY --from=builder /app /app
ENV NODE_ENV=production
EXPOSE 5010
CMD ["node", "dist/index.js"] 