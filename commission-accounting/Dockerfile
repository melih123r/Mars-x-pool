FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY pool/ ./pool/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
