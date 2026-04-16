FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --production

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
