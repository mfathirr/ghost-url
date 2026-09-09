# GhostURL 👻

> Ephemeral, account-less link sharing application built with Go (Gin), React (Vite & Tailwind CSS), and Redis.

GhostURL is designed for secure, temporary link sharing. Links automatically vanish from memory once their time-to-live (TTL) expires. Zero user accounts, zero cookies, zero persistent databases.

---

## ✨ Features

- **Ephemeral Expiry via Redis TTL**: Explicit expiration (5m, 30m, 1h, 24h, or custom up to 7 days). No cleanup cron scripts required—Redis memory eviction handles deletion automatically.
- **Optional Passcode Protection**: Links can be protected with a passcode, hashed using `bcrypt`. Plaintext secrets are never stored.
- **Custom Aliases**: Choose an optional custom slug (e.g., `my-link`) or let the system generate a cryptographically secure 8-character random slug.
- **QR Code Sharing**: Instant QR code generation with download option for seamless mobile access.
- **Dedicated Link Screen**: Instant one-click copy button, live expiry countdown, and test redirect links.
- **Dark & Light Mode**: Auto-detects system theme with manual persistence toggle.
- **Production-Grade Performance**: Route-based code splitting, Vite vendor chunk separation, and Go connection pooling.

---

## 🏗️ Architecture & Stack

```
ghost-url/
├── backend/            # Go 1.21+ API service (Gin, go-redis, bcrypt)
│   ├── cmd/server/     # Entry point & graceful shutdown
│   ├── internal/
│   │   ├── config/     # Environment variable configuration
│   │   ├── handlers/   # HTTP REST handlers & unit tests
│   │   ├── models/     # Request/response structs
│   │   ├── storage/    # Redis Hash storage & connection pool
│   │   └── utils/      # Slug generator, validation & tests
│   └── Dockerfile      # Multi-stage Go build
├── frontend/           # React 18+ SPA (Vite, TypeScript, Tailwind CSS)
│   ├── src/
│   │   ├── components/ # Navbar, ThemeToggle, LoadingSpinner
│   │   ├── pages/      # CreatePage, CreatedPage, RedirectPage, 404
│   │   ├── services/   # API client
│   │   └── types/      # TypeScript interfaces
│   ├── nginx.conf      # SPA reverse proxy & gzip compression
│   └── Dockerfile      # Multi-stage Node + Nginx build
└── docker-compose.yml  # Local orchestration for Redis, backend, frontend
```

---

## 🚀 Quick Start with Docker Compose

To start the entire application (Redis, Go Backend, and React Frontend) with a single command:

```bash
docker compose up --build
```

Once started:
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Redis**: `localhost:6379`

To stop all services:
```bash
docker compose down
```

---

## 🛠️ Local Development (Without Docker)

### 1. Start Redis
Make sure Redis is running locally on port `6379`:
```bash
redis-server
```

### 2. Run Go Backend
```bash
cd backend
go run ./cmd/server
```
The backend will run on `http://localhost:8080`.

### 3. Run React Frontend
```bash
cd frontend
bun install   # or npm install
bun dev       # or npm run dev
```
The frontend dev server runs on `http://localhost:5173` with an automatic proxy forwarding `/api` to the backend.

---

## 🧪 Testing

### Backend Unit Tests
```bash
cd backend
go test -v ./...
```

### Frontend Typecheck & Production Build
```bash
cd frontend
bun run build # or npm run build
```

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/links` | Create a new ephemeral link with optional alias, passcode, and TTL |
| `GET` | `/api/links/:slug` | Retrieve public link metadata (protection status, TTL remaining) |
| `POST` | `/api/links/:slug/unlock` | Verify passcode and retrieve original destination URL |
| `GET` | `/r/:slug` | Direct redirect (302 for open links; redirects to passcode screen if protected) |
| `GET` | `/health` | Health check endpoint verifying Redis ping status |

---

## 🔒 Security & Data Modeling

- **Redis Key Convention**: `link:{slug}` stored as a Redis `Hash` containing fields `url`, `passcode_hash`, `created_at`, and `expires_at`.
- **Atomic TTL**: Stored and expired using a transactional pipeline (`pipe.HSet(...)` + `pipe.Expire(...)`).
- **Passcode Hashing**: All passcodes are hashed using `golang.org/x/crypto/bcrypt` at standard cost before storing.
