# Build Angular app
FROM node:20-alpine as build
WORKDIR /app
COPY package.json angular.json tsconfig.json tsconfig.app.json ./
COPY src ./src
RUN npm install && npm run build

# Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/mywebapp-client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
