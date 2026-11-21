FROM node:22-trixie

WORKDIR /usr/src/app

COPY src/package.json src/package-lock.json ./
RUN npm ci --omit=dev
RUN node -e "const db = new (require('sqlite3').Database)(':memory:'); db.get('SELECT 1', error => { if (error) throw error; db.close(); });"

COPY src ./

EXPOSE 3000

CMD ["npm", "run", "start"]
