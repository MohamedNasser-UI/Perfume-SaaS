FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api/v1
ARG VITE_LICENSE_PUBLIC_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LICENSE_PUBLIC_KEY=$VITE_LICENSE_PUBLIC_KEY
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspace=@perfume/web --include-workspace-root
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
