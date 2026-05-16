FROM openscad/openscad:dev

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY public/openscad ./public/openscad
COPY render-service/server.mjs ./render-service/server.mjs

ENV NODE_ENV=production
ENV OPENSCAD_BIN=/usr/local/bin/openscad
ENV PORT=8080
ENV RENDER_MAX_CONCURRENCY=1
ENV RENDER_MAX_QUEUE_LENGTH=10
ENV RENDER_TIMEOUT_MS=120000
ENV OPENSCAD_ENABLE_TEXTMETRICS=1

EXPOSE 8080

CMD ["node", "render-service/server.mjs"]
