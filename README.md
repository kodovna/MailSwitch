# MailSwitch

Self-hosted bulk email migration tool that transfers up to 50 email accounts between IMAP servers. Single `docker-compose up` command to run, with a web UI for uploading account mappings and monitoring real-time migration progress.

## Features

- Migrate up to 50 IMAP accounts in parallel (5 concurrent by default)
- Full migration, delta sync (incremental), and continuous sync modes
- Real-time progress tracking via Server-Sent Events
- Per-account and per-folder progress with error logging
- Pause, resume, cancel, and retry controls
- CSV-based account mapping with drag-and-drop upload
- SSL/TLS (port 993) and STARTTLS (port 143) support
- SQLite database with Docker volume persistence
- Automatic retry with exponential backoff on connection/message errors

## Quick Start

```bash
git clone git@github.com:syafi-dev/MailSwitch.git
cd mailswitch
docker-compose up -d
```

Open **http://localhost:3000** in your browser.

## Usage

### 1. Prepare a CSV file

Create a CSV file with your account mappings:

```csv
src_email,src_password,src_host,src_port,dst_email,dst_password,dst_host,dst_port
user1@old.com,pass1,imap.old.com,993,user1@new.com,newpass1,imap.new.com,993
user2@old.com,pass2,imap.old.com,,user2@new.com,newpass2,imap.new.com,
```

| Column | Required | Description |
|--------|----------|-------------|
| `src_email` | Yes | Source email address |
| `src_password` | Yes | Source email password |
| `src_host` | Yes | Source IMAP server hostname |
| `src_port` | No | Source IMAP port (default: 993) |
| `dst_email` | Yes | Destination email address |
| `dst_password` | Yes | Destination email password |
| `dst_host` | Yes | Destination IMAP server hostname |
| `dst_port` | No | Destination IMAP port (default: 993) |

### 2. Upload and start migration

1. Open **http://localhost:3000**
2. Drag and drop your CSV file (or click to browse)
3. Review the parsed account list
4. Select migration mode:
   - **One-time Migration** — migrates all emails once
   - **Continuous Sync** — migrates then re-syncs every 5 minutes
5. Click **Start Migration**

### 3. Monitor progress

The dashboard shows:
- Overall progress bar with total/migrated/failed message counts
- Per-account progress with status badges
- Pause, cancel, and retry controls
- Click any account row to see per-folder breakdown and error log

## IMAP Ports

| Port | Protocol | When to use |
|------|----------|-------------|
| **993** | IMAP over SSL/TLS | Most providers (Gmail, Outlook, Yahoo, etc.) |
| **143** | IMAP with STARTTLS | Some self-hosted servers |

Port 993 is used by default if omitted from the CSV.

## Architecture

```
Docker Container (port 3000)
├── Express Server
│   ├── REST API (/api/*)
│   ├── SSE endpoint (/api/events)
│   └── Static file serving (React build)
├── Migration Engine
│   ├── Async queue (max 5 concurrent accounts)
│   └── Account Migrator (ImapFlow wrapper)
└── SQLite Database (/data/mailswitch.db)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS |
| Backend | Express 4 |
| IMAP | imapflow |
| Database | SQLite via better-sqlite3 |
| CSV parsing | papaparse |
| Real-time | Server-Sent Events |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Container | Docker multi-stage build |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload and validate CSV file |
| `POST` | `/api/jobs` | Create migration job |
| `GET` | `/api/jobs/:id` | Get job status with accounts |
| `POST` | `/api/jobs/:id/start` | Start or resume migration |
| `POST` | `/api/jobs/:id/pause` | Pause migration |
| `POST` | `/api/jobs/:id/cancel` | Cancel migration |
| `POST` | `/api/jobs/:id/retry-failed` | Retry all failed accounts |
| `POST` | `/api/jobs/:id/sync` | Toggle continuous sync |
| `GET` | `/api/accounts/:id` | Account detail with folder breakdown |
| `GET` | `/api/accounts/:id/errors` | Error log for an account |
| `POST` | `/api/accounts/:id/retry` | Retry single failed account |
| `GET` | `/api/events?job_id=X` | SSE stream for real-time updates |
| `GET` | `/api/health` | Health check |

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `/data/mailswitch.db` | SQLite database path |
| `MAX_CONCURRENT` | `5` | Max parallel account migrations |
| `SYNC_INTERVAL` | `300` | Continuous sync interval in seconds |
| `MAX_RETRIES` | `3` | Connection retry attempts |
| `MESSAGE_RETRIES` | `2` | Per-message retry attempts |
| `LOG_LEVEL` | `info` | Log level (error, warn, info, debug) |

## Data Persistence

Migration data is stored in a Docker volume (`mailswitch-data`). Stopping and restarting the container preserves all job history, progress, and error logs.

## Development

To run locally without Docker:

```bash
# Terminal 1: Start server
cd server
npm install
DB_PATH=./data/mailswitch.db UPLOAD_DIR=./data/uploads node index.js

# Terminal 2: Start frontend dev server
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:3000`.

## Project Structure

```
MailSwitch/
├── docker-compose.yml
├── Dockerfile
├── server/
│   ├── index.js                  # Express entry point
│   ├── config.js                 # Environment config
│   ├── db/
│   │   ├── database.js           # SQLite init + query helpers
│   │   └── schema.sql            # Table definitions
│   ├── routes/
│   │   ├── upload.js             # CSV upload
│   │   ├── jobs.js               # Job CRUD + controls
│   │   ├── accounts.js           # Account status + errors
│   │   └── events.js             # SSE stream
│   ├── services/
│   │   ├── csv-parser.js         # CSV parsing + validation
│   │   ├── migration-engine.js   # Orchestrator + queue
│   │   ├── account-migrator.js   # Single account migration
│   │   ├── imap-client.js        # ImapFlow wrapper
│   │   ├── delta-sync.js         # Incremental sync logic
│   │   ├── event-bus.js          # EventEmitter for SSE
│   │   └── queue.js              # Concurrency-limited queue
│   ├── middleware/
│   │   ├── error-handler.js      # Global error handler
│   │   └── upload-middleware.js   # Multer config
│   └── utils/
│       ├── logger.js             # Structured JSON logging
│       ├── retry.js              # Retry with backoff
│       └── validators.js         # Input validation
└── client/
    ├── src/
    │   ├── pages/
    │   │   ├── UploadPage.jsx        # CSV upload + preview
    │   │   ├── DashboardPage.jsx     # Job progress + controls
    │   │   └── AccountDetailPage.jsx # Folder + error detail
    │   ├── components/               # Reusable UI components
    │   ├── hooks/
    │   │   ├── useSSE.js             # SSE connection hook
    │   │   └── useMigrationState.js  # Job state management
    │   └── lib/
    │       ├── api.js                # API client
    │       └── format.js             # Formatting helpers
    └── vite.config.js
```
