FROM node:20.13.1-alpine3.18

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system proxyherd && \
    adduser --system -G proxyherd proxyherd

COPY ["dist/proxyherd/package*.json", "./"]

RUN npm install --production

COPY dist/proxyherd .

RUN chown -R proxyherd:proxyherd .

CMD [ "node", "proxyherd.js" ]
