# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (see docker-compose): this app imports the shared data layer
# from ../storefront/src via the @shared alias.

FROM node:20-alpine AS build
WORKDIR /app/storefront-starspice

COPY storefront-starspice/package.json storefront-starspice/package-lock.json ./
RUN npm ci

COPY storefront/src /app/storefront/src
COPY storefront-starspice/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/storefront-starspice/dist /usr/share/nginx/html
COPY storefront-starspice/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
