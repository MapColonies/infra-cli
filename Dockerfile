FROM node:22 as build


WORKDIR /tmp/buildApp

COPY ./package*.json ./
COPY .husky/ .husky/

RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine3.21 as production


ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./
COPY .husky/ .husky/

RUN npm ci --only=production

COPY --chown=node:node --from=build /tmp/buildApp/dist ./dist
COPY --chown=node:node --from=build /tmp/buildApp/bin ./bin
COPY --chown=node:node --from=build /tmp/buildApp/oclif.config.mjs ./

USER node
ENTRYPOINT [ "./bin/run.js" ]
CMD [ "--help" ]
