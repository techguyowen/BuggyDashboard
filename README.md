# Triangle Liquidators Live Auction Tracker & Out-of-Pocket Calculator
### GitHub Repository: `techguyowen/TL-Dashboard`

A real-time auction tracking dashboard built with Node.js, Express, and Puppeteer. Features live countdown timers, financial fee calculations (15% Buyer Premium + 7.25% Tax + 3% Credit Card fee), custom keyword watchlists, and headless auction account synchronization.

---

## ⚡ Option 1: Run Directly from GitHub (No Cloning Needed!)

Anyone with Docker installed can run this dashboard directly from your GitHub repository (`techguyowen/TL-Dashboard`) without cloning the source code.

### Step 1: Save `docker-compose.yml` on any server

```yaml
version: '3.8'

services:
  tl-auction-dashboard:
    build:
      context: https://github.com/techguyowen/TL-Dashboard.git#main
      dockerfile: Dockerfile
    container_name: tl-auction-dashboard
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/progress"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

### Step 2: Start the server

```bash
docker compose up -d --build
```

---

## 📦 Option 2: Prebuilt Container from GitHub Container Registry (GHCR)

Once GitHub Actions builds the image automatically, anyone can launch it in seconds:

```bash
docker run -d \
  --name tl-auction-dashboard \
  -p 3001:3001 \
  --restart unless-stopped \
  ghcr.io/techguyowen/tl-dashboard:latest
```

---

## 💻 Running Locally / Development

```bash
# Clone repository
git clone https://github.com/techguyowen/TL-Dashboard.git
cd TL-Dashboard

# Install & Run
npm install
npm start
```

Access the dashboard at `http://localhost:3001`.
