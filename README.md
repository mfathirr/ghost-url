<div align="center">

# 👻 GhostURL

**Ephemeral, self-destructing short links & zero-persistence peer-to-peer radar transfer.**

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Key Features](#-key-features) • [Architecture](#-architecture) • [Quickstart with Docker](#-quickstart-with-docker-compose) • [Local Development](#-local-development) • [API Reference](#-api--websocket-reference) • [Security & Privacy](#-security--privacy)

</div>

---

## 📖 Overview

**GhostURL** is an account-less, privacy-first web utility combining three core capabilities into a cohesive interface:

1. **⚡ Quick Bridge (Ephemeral Link Shortener)**: Short links that self-destruct after a specified duration using native Redis hardware/memory TTL eviction. Optionally protect sensitive destinations with salted **bcrypt** passcodes.
2. **📡 Nearby Radar (AirDrop / Snapdrop P2P Sharing)**: Instant, zero-setup local-network device discovery. Beam links, text, and messages directly between devices over encrypted **WebRTC DataChannels** without ever touching backend databases or persistent storage.
3. **🚀 GhostDrop (Zero-Storage P2P File Beaming)**: Beam files of arbitrary size (tested up to 1.12+ GB) directly between peer browsers with dual-engine streaming (WebRTC DataChannels + WebSocket signaling relay fallback), adaptive backpressure flow control, and zero server storage.

---

## ✨ Key Features

### ⚡ 1. Quick Bridge
- **Native Redis TTL Expiration**: Preset durations (`5m`, `30m`, `1h`, `24h`) or custom expirations up to 7 days. Keys are evicted automatically from RAM when expired.
- **Bcrypt Passcode Protection**: Optional secret passcodes are hashed using standard bcrypt salt rounds before persistence.
- **Custom Slugs or Secure Random IDs**: Pick a custom vanity alias or let the Go backend allocate an 8-character cryptographically random base62 slug.
- **Instant QR Code Generation**: In-browser client-side QR generation ready for immediate mobile camera scanning.
- **Transparent Redirection**: Direct `302 Found` redirects for open links, and a secure password-unlock form for protected destinations.

### 📡 2. Nearby Radar
- **Zero-Setup Local Network Discovery**: Devices connected to the same Wi-Fi or gateway automatically discover one another via transient public IP hashing.
- **Manual Room Code Fallback**: Optional 6-digit room codes allow peers on disparate mobile cellular networks or isolated VPNs to connect instantly.
- **Device & OS Fingerprinting**: Intelligently parses User-Agents to show familiar hardware labels (e.g. *macOS • Desktop*, *iOS • Mobile*).
- **Fun Peer Monikers**: Generates friendly pseudonyms for each peer (e.g. *"Neon Falcon"*, *"Swift Otter"*, *"Solar Lynx"*).
- **Encrypted WebRTC DataChannels**: Peer-to-peer data flows directly between browser clients via Google STUN negotiation (`stun:stun.l.google.com:19302`). Data **never** hits backend disks or databases.
- **Slide-up Beam Modal**: Real-time notifications with one-click **Open Link** and **Copy to Clipboard** actions.

### 🚀 3. GhostDrop (Zero-Storage File Beaming)
- **Zero Cloud Storage**: Files stream chunk-by-chunk directly between browser memories over WebRTC DataChannels or WebSocket signaling relay fallback. Never written to Redis, disk, or backend databases.
- **Dual-Engine Streaming**: Automatic fallback from raw binary `RTCDataChannel` (16 KB binary chunks) to Go WebSocket hub relay (16 KB base64 chunks) for guaranteed delivery across restrictive firewalls or isolated mDNS profiles.
- **Adaptive Backpressure Flow Control**: Monitors buffer thresholds (`bufferedAmount > 128 KB` for DataChannel, `> 64 KB` for WebSocket) to stream large files (tested up to 1.12+ GB) without memory bloat or browser crashes.
- **Visual Avatar Progress Rings**: `PeerAvatarWithProgress` displays circular SVG progress meters and percentage indicators around peer nodes during active uploads and downloads.
- **File Offer Handshake**: Recipient previews incoming file name, formatted size, and type with explicit Accept or Decline options before receiving bytes.
- **Automatic Cleanup**: Assembles `Blob` in receiver memory, prompts download, and revokes ephemeral object URLs after 60 seconds.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Clients ["Client Devices"]
        PeerA["Peer A (Desktop Browser)"]
        PeerB["Peer B (Mobile Browser)"]
        Visitor["Public Visitor"]
    end

    subgraph Frontend ["Frontend (Vite / Nginx)"]
        SPA["React 19 SPA"]
    end

    subgraph Backend ["Go Backend (Gin Framework)"]
        Router["HTTP Router"]
        P2P_Hub["In-Memory P2P Hub"]
    end

    subgraph DataStore ["Database"]
        Redis[("Redis 7 (Pure RAM with Native TTL)")]
    end

    %% Link Shortening
    PeerA -->|POST /api/links| Router
    Router -->|HSet + Expire| Redis
    Visitor -->|GET /r/:slug| Router
    Router -->|GetLink + TTL| Redis
    Router -->|302 Redirect| Visitor

    %% P2P Signaling & Mesh
    PeerA <-->|WebSocket: Signaling & Relay Fallback| P2P_Hub
    PeerB <-->|WebSocket: Signaling & Relay Fallback| P2P_Hub
    PeerA <===>|WebRTC DataChannel (Direct P2P Link & GhostDrop Streaming)| PeerB
```

### Monorepo Structure

```
ghost-url/
├── backend/            # Go 1.22+ API & WebSocket Signaling Service
│   ├── cmd/server/     # Server entrypoint & graceful shutdown
│   ├── internal/
│   │   ├── config/     # Environment variable configuration
│   │   ├── handlers/   # HTTP REST link handlers & unit tests
│   │   ├── models/     # Request/response JSON data structures
│   │   ├── p2p/        # In-memory signaling hub, client pumps & UA parser
│   │   ├── storage/    # Redis connection pooling & Hash operations
│   │   └── utils/      # URL validator, slug generator & TTL parser
│   └── Dockerfile      # Multi-stage Alpine production image
├── frontend/           # React 19 + TypeScript + Vite + Tailwind CSS + Vercel Analytics
│   ├── src/
│   │   ├── components/ # GhostDropZone, PeerAvatarWithProgress, IncomingModal, Navbar
│   │   ├── context/    # P2PContext for cross-route WebRTC state & file streaming
│   │   ├── hooks/      # useP2P hook managing WebRTC & WebSocket lifecycle
│   │   ├── pages/      # CreatePage (Link & Drop), CreatedPage (Radar), RedirectPage, 404
│   │   ├── services/   # Typed REST API client
│   │   ├── types/      # TypeScript interfaces
│   │   └── utils/      # Clipboard helpers & formatting utilities
│   ├── nginx.conf      # SPA routing & WebSocket proxy configuration
│   └── Dockerfile      # Multi-stage Node build -> Nginx image
└── docker-compose.yml  # Multi-container orchestration (Redis, Go, Nginx)
```

---

## 🚀 Quickstart with Docker Compose

Spin up Redis 7, the Go Backend, and the React Frontend with a single command:

```bash
docker compose up --build
```

Once started:
- **Web Application**: [http://localhost:5173](http://localhost:5173)
- **Go API & WebSocket Hub**: [http://localhost:8080](http://localhost:8080)
- **Redis Server**: `localhost:6379`

To stop all services:
```bash
docker compose down
```

---

## 🛠️ Local Development (Without Docker)

### 1. Start Redis
```bash
redis-server
```

### 2. Start Go Backend
```bash
cd backend
go run ./cmd/server
```
Runs at `http://localhost:8080`.

### 3. Start React Frontend
```bash
cd frontend

# Using npm:
npm install
npm run dev

# Or using bun:
bun install
bun dev
```
Runs at `http://localhost:5173`. Vite automatically proxies `/api` and `/ws` to the backend.

---

## 🧪 Automated Testing

### Backend Unit Tests
Runs handler tests, slug randomness checks, and concurrent P2P hub signaling tests:
```bash
cd backend
go test -v ./...
```

### Frontend Typechecking & Build
```bash
cd frontend
npm run build
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the Go HTTP & WebSocket server |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL (`redis://` or `rediss://` for TLS) |
| `BASE_URL` | `http://localhost:8080` | Base URL used when assembling generated short links |
| `FRONTEND_URL` | `http://localhost:5173` | URL of the frontend SPA for unlock redirects |
| `REDIS_POOL_SIZE`| `10` | Redis client connection pool size |
| `GIN_MODE` | `debug` | Set to `release` in production |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base path or URL for REST API calls |
| `VITE_WS_URL` | `/ws/p2p` | WebSocket URL for Nearby Radar signaling |

---

## 📡 API & WebSocket Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/links` | Create an ephemeral short link with TTL & optional passcode |
| `GET` | `/api/links/:slug` | Check public metadata (protection status, remaining TTL) |
| `POST` | `/api/links/:slug/unlock` | Verify passcode and reveal destination URL |
| `GET` | `/r/:slug` | Direct 302 redirect for public links (or route to unlock form) |
| `GET` | `/health` | Health check probe verifying Redis connectivity |
| `GET` | `/ws/p2p` | WebSocket endpoint for IP discovery & WebRTC signaling |

### Example: Create Ephemeral Link
```bash
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/google/antigravity",
    "alias": "antigravity-guide",
    "passcode": "secret123",
    "expires_in": "1h"
  }'
```

Response:
```json
{
  "slug": "antigravity-guide",
  "short_url": "http://localhost:8080/r/antigravity-guide",
  "expires_at": "2026-09-09T16:00:00Z",
  "ttl_seconds": 3600,
  "has_passcode": true
}
```

---

## 🔒 Security & Privacy

- **Zero Database Retention for P2P & GhostDrop**: WebRTC DataChannels and WebSocket signaling relay streams transfer data directly between browser engines. URLs, text, and files beamed via radar or GhostDrop never touch persistent disks, databases, or server logs.
- **Volatile Redis Expiration**: All links use Redis `EXPIRE`. When the TTL elapses, keys are evicted automatically by hardware memory management.
- **Bcrypt Passcode Hashing**: Link passcodes are salted and hashed with standard bcrypt cost before being stored.
- **Zero Client IP Logging**: Public IP addresses are processed in-memory solely to isolate local radar rooms and are never written to disk.
- **Privacy-Preserving Telemetry**: Integrated with `@vercel/analytics` in a 100% cookieless and GDPR-compliant mode without recording PII or client IP addresses.

---

## 📄 License

Distributed under the MIT License.
