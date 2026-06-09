FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate
COPY src ./src
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
