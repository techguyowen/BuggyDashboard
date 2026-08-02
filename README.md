# Buggy Busters Live Auction Tracker & Out-of-Pocket Calculator
### GitHub Repository: `techguyowen/BuggyDashboard`

A real-time auction tracking dashboard built with Node.js, Express, and Puppeteer. Features live countdown timers, financial fee calculations (15% Buyer Premium + 7.25% Tax + 3% Credit Card fee), custom keyword watchlists, exclude keyword filters, and headless auction account synchronization.

---

## ⚡ Option 1: Deploy with Docker Compose (Prebuilt GitHub Image)

GitHub Actions automatically builds and publishes the container image to GitHub Container Registry (`ghcr.io/techguyowen/buggydashboard:latest`). Anyone with Docker installed can launch the dashboard in seconds without needing to clone or compile code.

### Step 1: Save `docker-compose.yml` on your server

```yaml
version: '3.8'

services:
  buggy-auction-dashboard:
    image: ghcr.io/techguyowen/buggydashboard:latest
    container_name: buggy-auction-dashboard
    restart: unless-stopped
    ports:
      - "7422:7422"
    volumes:
      - ./catalog_cache.json:/app/catalog_cache.json
    environment:
      - PORT=7422
      - HOST=0.0.0.0
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:7422/api/progress"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

### Step 2: Start the server

```bash
docker compose up -d
```

Access the dashboard at `http://<your-server-ip>:7422` (or `http://localhost:7422`).

---

## 📦 Option 2: Run directly with `docker run` (Prebuilt Image)

```bash
docker run -d \
  --name buggy-auction-dashboard \
  -p 7422:7422 \
  -e PORT=7422 \
  -e HOST=0.0.0.0 \
  -v ./catalog_cache.json:/app/catalog_cache.json \
  --restart unless-stopped \
  ghcr.io/techguyowen/buggydashboard:latest
```

---

## 🛠️ Option 3: Build from Source with Docker Compose

If you want Docker to build the image locally from GitHub source code instead of pulling the prebuilt image:

```yaml
version: '3.8'

services:
  buggy-auction-dashboard:
    build:
      context: https://github.com/techguyowen/BuggyDashboard.git#main
      dockerfile: Dockerfile
    container_name: buggy-auction-dashboard
    restart: unless-stopped
    ports:
      - "7422:7422"
    volumes:
      - ./catalog_cache.json:/app/catalog_cache.json
    environment:
      - PORT=7422
      - HOST=0.0.0.0
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:7422/api/progress"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

```bash
docker compose up -d --build
```

---

## 💻 Running Locally / Development

```bash
# Clone repository
git clone https://github.com/techguyowen/BuggyDashboard.git
cd BuggyDashboard

# Install & Run
npm install
npm start
```

Access the dashboard at `http://localhost:7422`.
