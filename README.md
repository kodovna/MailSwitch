# MailSwitch

Self-hosted bulk email migration tool that transfers up to 500 email accounts between IMAP servers. Single `docker-compose up` command to run, with a web UI for configuring servers, verifying accounts, and monitoring real-time migration progress.

## Features

- **Guided 3-step wizard** — Server Config → Upload CSV → Preview & Start
- **IMAP connectivity test** — verify source/destination servers before uploading accounts
- **Account authentication check** — validate all credentials before starting migration
- Migrate up to 500 IMAP accounts in parallel (10 concurrent by default)
- Full migration, delta sync (incremental), and continuous sync modes
- **Resync button** — catch up new emails after a completed one-time migration
- Real-time progress tracking via Server-Sent Events
- Per-account and per-folder progress with error logging
- Pause, resume, cancel, and retry controls
- Simplified 4-column CSV format (server config set once per job)
- SSL/TLS (port 993) and STARTTLS (port 143) support, including self-signed certificates
- SQLite database with Docker volume persistence
- Automatic retry with exponential backoff on connection/message errors

## Quick Start

```bash
git clone git@github.com:syafi-dev/MailSwitch.git
cd MailSwitch
docker-compose up -d
```

Open **http://localhost:3000** in your browser.

## Usage

### 1. Configure IMAP servers

Enter the source and destination IMAP server details (host and port), then click **Test Connections**. Both servers must respond with an IMAP greeting before proceeding.

Once both show green checkmarks, click **Next**.

### 2. Upload account CSV

Prepare a CSV file with account credentials:

```csv
src_email,src_password,dst_email,dst_password
user1@old.com,pass1,user1@new.com,newpass1
user2@old.com,pass2,user2@new.com,newpass2
```

| Column | Required | Description |
|--------|----------|-------------|
| `src_email` | Yes | Source email address |
| `src_password` | Yes | Source email password |
| `dst_email` | Yes | Destination email address |
| `dst_password` | Yes | Destination email password |

Server host/port are configured once in Step 1 and apply to all accounts in the job.

Drag and drop the CSV file (or click to browse).

### 3. Verify and start

1. Review the parsed account list
2. Click **Verify Accounts** — authenticates every account against both servers
3. All accounts must pass verification (green checkmarks) before migration can start
4. Select migration mode:
   - **One-time Migration** — migrates all emails once
   - **Continuous Sync** — migrates then re-syncs every 5 minutes
5. Click **Start Migration**

### 4. Monitor progress

The dashboard shows:
- Server info (`source:port → destination:port`) in the job header
- Overall progress bar with total/migrated/failed message counts
- Per-account progress with status badges
- Pause, cancel, and retry controls
- Click any account row to see per-folder breakdown and error log

### 5. Resync (catch up new emails)

After a one-time migration completes, a **Resync** button appears on the dashboard. Click it to run a delta sync that picks up any new emails that arrived since the last migration. Only new messages are transferred (uses IMAP UID tracking).

## IMAP Ports

| Port | Protocol | When to use |
|------|----------|-------------|
| **993** | IMAP over SSL/TLS | Most providers (Gmail, Outlook, Yahoo, etc.) |
| **143** | IMAP with STARTTLS | Some self-hosted servers |

Port 993 is used by default. Self-signed certificates are accepted.

## Architecture

```
Docker Container (port 3000)
├── Express Server
│   ├── REST API (/api/*)
│   ├── SSE endpoint (/api/events)
│   └── Static file serving (React build)
├── Migration Engine
│   ├── Async queue (max 10 concurrent accounts)
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
| `POST` | `/api/jobs/test-connection` | Test IMAP server connectivity |
| `POST` | `/api/jobs/test-auth` | Test IMAP account authentication |
| `POST` | `/api/jobs` | Create migration job (with server config) |
| `GET` | `/api/jobs/:id` | Get job status with accounts |
| `POST` | `/api/jobs/:id/start` | Start or resume migration |
| `POST` | `/api/jobs/:id/pause` | Pause migration |
| `POST` | `/api/jobs/:id/cancel` | Cancel migration |
| `POST` | `/api/jobs/:id/retry-failed` | Retry all failed accounts |
| `POST` | `/api/jobs/:id/resync` | Resync completed job (delta sync) |
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
| `MAX_CONCURRENT` | `10` | Max parallel account migrations |
| `SYNC_INTERVAL` | `300` | Continuous sync interval in seconds |
| `MAX_RETRIES` | `3` | Connection retry attempts |
| `MESSAGE_RETRIES` | `2` | Per-message retry attempts |
| `LOG_LEVEL` | `info` | Log level (error, warn, info, debug) |
| `MAILBOX_CSV_PATH` | _(empty)_ | CSV with columns `email, username, password` (header optional). Its addresses are suggested in the source e-mail field of step 2 |

Picking an address from the suggestions fills the row: source = `username` from the CSV, destination = the address, both with `password` from the CSV.

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
│   │   ├── jobs.js               # Job CRUD + controls + connectivity tests
│   │   ├── accounts.js           # Account status + errors
│   │   └── events.js             # SSE stream
│   ├── services/
│   │   ├── csv-parser.js         # CSV parsing + validation
│   │   ├── migration-engine.js   # Orchestrator + queue
│   │   ├── account-migrator.js   # Single account migration
│   │   ├── imap-client.js        # ImapFlow wrapper + connectivity/auth tests
│   │   ├── delta-sync.js         # Incremental sync logic
│   │   ├── event-bus.js          # EventEmitter for SSE
│   │   └── queue.js              # Concurrency-limited queue
│   ├── middleware/
│   │   ├── error-handler.js      # Global error handler
│   │   └── upload-middleware.js   # Multer config
│   └── utils/
│       ├── logger.js             # Structured JSON logging
│       ├── retry.js              # Retry with backoff
│       └── validators.js         # Input + server config validation
└── client/
    ├── src/
    │   ├── pages/
    │   │   ├── UploadPage.jsx        # 3-step migration wizard
    │   │   ├── DashboardPage.jsx     # Job progress + controls
    │   │   └── AccountDetailPage.jsx # Folder + error detail
    │   ├── components/
    │   │   ├── ServerConfigForm.jsx  # Server config + connectivity test
    │   │   ├── CsvUploader.jsx       # Drag-and-drop CSV upload
    │   │   ├── CsvPreview.jsx        # Account preview with auth status
    │   │   └── ...                   # Other UI components
    │   ├── hooks/
    │   │   ├── useSSE.js             # SSE connection hook
    │   │   └── useMigrationState.js  # Job state management
    │   └── lib/
    │       ├── api.js                # API client
    │       └── format.js             # Formatting helpers
    └── vite.config.js
```
