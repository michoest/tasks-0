# Deployment Guide

## Frontend (GitHub Pages → todo.michoest.com)

### Prerequisites
1. Make sure you have a GitHub repository set up
2. Configure your custom domain `todo.michoest.com` in GitHub Pages settings

### Deploy

```bash
./deploy-client.sh
```

Or manually:
```bash
cd packages/client
npm run build
npx gh-pages -d dist
```

### GitHub Pages Configuration
1. Go to your repository settings
2. Navigate to Pages
3. Set source to `gh-pages` branch
4. Add custom domain: `todo.michoest.com`
5. Enable HTTPS

## Backend (Raspberry Pi → todo.server.michoest.com)

### Prerequisites on Pi
1. Node.js installed
2. Domain `todo.server.michoest.com` pointing to your Pi
3. SSL certificate (use Let's Encrypt/certbot)
4. PM2 or similar process manager

### Deployment Steps

1. **Copy files to Pi:**
   ```bash
   scp -r packages/server pi@your-pi-ip:~/todo-api
   ```

2. **On the Pi, install dependencies:**
   ```bash
   cd ~/todo-api
   npm install --production
   ```

3. **Set up environment variables:**
   Create `.env` file:
   ```bash
   NODE_ENV=production
   PORT=3000
   CLIENT_URL=https://todo.michoest.com
   SESSION_SECRET=your-secure-random-string-here
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   VAPID_EMAIL=mail@michoest.com
   ```

4. **Set up reverse proxy (nginx):**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name todo.server.michoest.com;

       ssl_certificate /path/to/fullchain.pem;
       ssl_certificate_key /path/to/privkey.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Start with PM2:**
   ```bash
   pm2 start src/index.js --name todo-api
   pm2 save
   pm2 startup
   ```

## Environment Variables

### Server (.env)
- `NODE_ENV` - Set to `production`
- `PORT` - Server port (default: 3000)
- `CLIENT_URL` - Frontend URL for CORS (https://todo.michoest.com)
- `SESSION_SECRET` - Random string for session encryption
- `VAPID_PUBLIC_KEY` - From `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` - From `npx web-push generate-vapid-keys`
- `VAPID_EMAIL` - Your email for push notifications

### Client (.env.production)
- `VITE_API_URL` - Backend API URL (https://todo.server.michoest.com)

## Database

The SQLite database (`database.db`) will be created automatically on first run in the server directory. Make sure to back it up regularly!

## SSL Certificates

### For Pi (Let's Encrypt):
```bash
sudo certbot --nginx -d todo.server.michoest.com
```

## Monitoring

Check server logs:
```bash
pm2 logs todo-api
```

Check server status:
```bash
pm2 status
```

Restart server:
```bash
pm2 restart todo-api
```
