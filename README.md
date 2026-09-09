# GhostURL 👻📡

> Ephemeral link sharing with automatic Redis TTL expiration & local-network Peer-to-Peer (P2P) direct transfer modeled after AirDrop and Snapdrop.

GhostURL provides two core privacy-first services in a single lightweight web app:
1. **Quick Bridge**: Account-less, ephemeral link shortening with auto-expiration via native Redis TTL and optional bcrypt passcode encryption.
2. **Nearby Radar**: Local-network, zero-setup direct peer-to-peer link and text sharing using WebRTC DataChannels with Go WebSocket signaling.

---

## ✨ Key Features

### 1. ⚡ Quick Bridge (Ephemeral Link Sharing)
- **Native Redis TTL Expiration**: Links self-destruct after a specified duration (5m, 30m, 1h, 24h, or custom up to 7 days). No cleanup cron scripts required—Redis memory eviction deletes expired keys automatically.
- **Bcrypt Passcode Protection**: Optional secret code for sensitive links. Passcodes are hashed with `golang.org/x/crypto/bcrypt` before saving.
- **Custom Slugs**: Choose a custom alias or let the Go backend assign a cryptographically secure 8-character random slug.
- **Instant QR Code Sharing**: Generate downloadable high-resolution QR codes for instant mobile scanning.
- **Direct Redirection**: Transparent 302 redirects for public links, with a sleek unlock prompt for passcode-protected URLs.

### 2. 📡 Nearby Radar (Snapdrop/AirDrop P2P Transfer)
- **Automatic Local Discovery**: Devices on the same public network/Wi-Fi automatically discover each other via client IP grouping.
- **Device & OS Fingerprinting**: Parses User-Agent to detect OS (macOS, iOS, Windows, Android, Linux) and device form factor (Desktop, Mobile, Tablet).
- **Random Monikers**: Assigns friendly monikers (e.g., *"Neon Falcon"*, *"Swift Otter"*) to each peer.
- **WebRTC DataChannels**: Client-to-client direct peer transfer using Google STUN (`stun:stun.l.google.com:19302`). Data never hits persistent backend storage.
- **Animated Sonar UI**: Visual radar with pulse rings and orbiting peers. Click any device to initiate direct transfer.
- **Slide-up Notifications**: Real-time modal with one-click "Open Link" and "Copy to Clipboard" buttons.
- **Manual Room Code Fallback**: Optional 6-digit room code allows peers on different networks or cellular connections to connect seamlessly.

---

## 🏗️ Architecture & Monorepo Structure

```
ghost-url/
├── backend/            # Go 1.26 API service (Gin, gorilla/websocket, go-redis, bcrypt)
│   ├── cmd/server/     # Entry point, router wiring & graceful shutdown
│   ├── internal/
│   │   ├── config/     # Environment variable configuration
│   │   ├── handlers/   # HTTP REST link handlers & tests
│   │   ├── models/     # Request/response structs
│   │   ├── p2p/        # In-memory signaling hub, client pump, UA parser, tests
│   │   ├── storage/    # Redis connection pooling & Hash operations
│   │   └── utils/      # URL validator, slug generator, TTL parser
│   └── Dockerfile      # Multi-stage Go build
├── frontend/           # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/ # TabBar, Navbar, IncomingModal, ThemeToggle, LoadingSpinner
│   │   ├── hooks/      # useP2P WebRTC & WebSocket management hook
│   │   ├── pages/      # CreatePage, RadarPage, CreatedPage, RedirectPage, 404
│   │   ├── services/   # REST API client
│   │   └── types/      # TypeScript definitions for Links & P2P signaling
│   ├── nginx.conf      # SPA reverse proxy, WebSocket upgrade & gzip compression
│   └── Dockerfile      # Multi-stage Node + Nginx build
└── docker-compose.yml  # Container orchestration (Redis, Go backend, Nginx frontend)
```

---

## 🚀 Quick Start with Docker Compose

Spin up Redis, the Go Backend, and the React Frontend with one command:

```bash
docker compose up --build
```

Once running:
- **Web Application**: [http://localhost:5173](http://localhost:5173)
- **Go API & WebSocket Hub**: [http://localhost:8080](http://localhost:8080)
- **Redis Server**: `localhost:6379`

To stop all services:
```bash
docker compose down
```

---

## 🧪 Testing P2P Radar Across Two Browser Tabs

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Click on the **Nearby Radar** tab. You'll see your device in the center of the radar (e.g. *"You • macOS • Neon Falcon"*).
3. Open a second browser tab (or an Incognito window) at [http://localhost:5173](http://localhost:5173) and switch to the **Nearby Radar** tab.
4. Each tab will immediately appear on the other's radar circle as an orbiting peer!
5. In Tab 1, click on Tab 2's icon to open the direct send panel.
6. Enter a URL (e.g. `https://github.com`) or text message and click **Direct Send**.
7. In Tab 2, a notification modal slides up from the bottom with **Open Link** and **Copy to Clipboard** options!

---

## 🛠️ Local Development (Without Docker)

### 1. Start Redis
```bash
redis-server
```

### 2. Run Go Backend
```bash
cd backend
go run ./cmd/server
```
Runs on `http://localhost:8080`.

### 3. Run React Frontend
```bash
cd frontend
npm install # or bun install
npm run dev # or bun dev
```
Runs on `http://localhost:5173`. Proxies `/api` and `/ws` to `http://localhost:8080`.

---

## 🧪 Automated Testing

### Backend Unit Tests (Handlers, P2P Hub, IP Extraction, UA Parser, Slug Generator)
```bash
cd backend
go test -v ./...
```

### Frontend Typecheck & Build
```bash
cd frontend
npm run build
```

---

## 📡 API & WebSocket Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/links` | Create an ephemeral short link with TTL & optional passcode |
| `GET` | `/api/links/:slug` | Check public metadata (protection status, remaining TTL) |
| `POST` | `/api/links/:slug/unlock` | Verify passcode and reveal destination URL |
| `GET` | `/r/:slug` | Direct 302 redirect for open links (or redirect to unlock view) |
| `GET` | `/ws/p2p` | WebSocket upgrade for IP-based discovery & WebRTC signaling |
| `GET` | `/health` | Health check probe verifying Redis connection |

---

## 🔒 Security & Privacy

- **Zero Database Persistence for P2P**: WebRTC DataChannels send data directly between clients via browser peer connections.
- **Zero Log Retention**: IP addresses are extracted in-memory solely for local room partitioning and are never written to disk.
- **Redis Auto-Eviction**: Links use `SET ... EX` / `EXPIRE` so expired links disappear automatically from memory.
- **Bcrypt Security**: Sensitive link passcodes are salted and hashed with standard bcrypt cost.
