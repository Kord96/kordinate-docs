FROM ghcr.io/kord96/infra-control-dashboard@sha256:e24f25d57d7d84ef7c4aedfa704be3dc0129c82eaa5d04521bfd24b6277f0a6f
WORKDIR /app
COPY package.json package-lock.json ./
RUN sha256sum -c /opt/infra/npm-source/package-lock.sha256 && npm ci --offline --ignore-scripts --no-audit --no-fund
COPY . .
RUN node scripts/infra-cycle-check.mjs && chown -R 10001:10001 /app
USER 10001:10001
EXPOSE 4321
STOPSIGNAL SIGTERM
CMD ["node", "scripts/infra-cycle-preview.mjs"]
