cd database
NODE_ENV=development knex migrate:latest
cd backend
pm2 start ecosystem.config.js
cd ../frontend
bun run build