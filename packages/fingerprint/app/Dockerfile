FROM node:20.9.0-alpine3.18

ENV NODE_ENV=production
ENV GEOIP_DIR=/data/geoip
ENV FINGERPRINT_PORT=3000

WORKDIR /app

RUN addgroup --system proxyherd && \
    adduser --system -G proxyherd proxyherd && \
    mkdir -p /data/geoip && \
    chown -R proxyherd:proxyherd /data

COPY ["dist/fingerprint/package*.json", "./"]

RUN npm install --production

COPY dist/fingerprint .

RUN chown -R proxyherd:proxyherd .

USER proxyherd

VOLUME [ "/data/geoip" ]

EXPOSE 3000

CMD [ "node", "fingerprint.js" ]
