FROM node:22-slim

WORKDIR /app

# Zero runtime dependencies - nothing to install.
COPY bot ./bot
COPY data ./data

ENV NODE_ENV=production \
    PORT=8080 \
    BOT_DATA_DIR=/app/state

RUN mkdir -p /app/state

EXPOSE 8080
CMD ["node", "bot/server.js"]
