# TaskFlow

TaskFlow is a full-stack team workspace for planning work, collaborating in real time, and running meetings from one place. It combines Kanban boards, personal task views, group chat, notifications, file sharing, video meetings, user administration, and an AI chat assistant in a responsive React application.

## Live application

| Service | URL |
| --- | --- |
| **Web application** | [https://taskflow-app-umber-ten.vercel.app](https://taskflow-app-umber-ten.vercel.app/) |
| **Backend API** | [https://taskflow-backend-ivsy.onrender.com](https://taskflow-backend-ivsy.onrender.com/) |
| **Health check** | [https://taskflow-backend-ivsy.onrender.com/api/health](https://taskflow-backend-ivsy.onrender.com/api/health) |

> [!IMPORTANT]
> ## DEMO LOGIN CREDENTIALS
>
> **USERNAME: `super_admin`**
>
> **PASSWORD: `super1234!`**
>
> Use these credentials on the live application's login screen. This account has **SUPER ADMIN** privileges.

> [!WARNING]
> The credentials above are intended for this demo deployment. Change `SEED_SUPER_ADMIN_USERNAME` and `SEED_SUPER_ADMIN_PASSWORD`, and rotate the password before using TaskFlow in a private or production environment.

## What TaskFlow includes

- **Workspace overview** — dashboard metrics, recent activity, upcoming work, and quick navigation.
- **Kanban boards** — create boards, customize workflow columns, drag tasks between stages, set priorities and due dates, assign multiple team members, and add comments.
- **Personal tasks** — review assigned and created work from a focused task view.
- **Real-time chat** — group and direct conversations, replies, mentions, typing state, unread tracking, search, and WebSocket delivery.
- **File sharing** — image, video, audio, and general file uploads through Cloudinary or local storage.
- **Tasko AI** — mention `@tasko_ai` in chat to request a context-aware Gemini response when the integration is configured.
- **Meetings** — schedule meetings, manage participants, and join LiveKit-powered audio/video rooms.
- **Notifications** — assignment, mention, meeting, and system notifications with read state.
- **Administration** — role-based user creation, editing, activation, and deletion.
- **Personalization** — profile editing, avatar upload, notification preferences, and light/dark themes.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, dnd-kit, Framer Motion, LiveKit Client, Lucide React |
| Backend | Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA, Spring WebSocket |
| Data | MySQL 8, Hibernate |
| Authentication | Stateless JWT authentication, BCrypt password hashing, role-based authorization |
| Integrations | Google Gemini, LiveKit, Cloudinary, DiceBear |
| Deployment | Vercel frontend, Render Docker service |

## Repository layout

```text
taskflow/
├── backend/                  # Spring Boot API, persistence, security, and WebSockets
│   ├── src/main/java/dev/taskflow/
│   │   ├── api/              # REST controllers and transport DTOs
│   │   ├── bootstrap/        # Initial super-admin and AI-user seeding
│   │   ├── domain/           # JPA entities
│   │   ├── repo/             # Spring Data repositories
│   │   ├── security/         # JWT authentication and access control
│   │   ├── service/          # External-service orchestration
│   │   └── ws/               # Chat and meeting WebSocket handlers
│   ├── Dockerfile
│   ├── render.yaml
│   └── pom.xml
├── docs/
│   └── architecture.md       # Architecture, request flows, deployment, and ERD
├── frontend/                 # React single-page application
│   ├── src/
│   │   ├── lib/api.js        # API client and service adapters
│   │   ├── main.jsx          # Routes and UI features
│   │   └── *.css             # Application styles
│   ├── vercel.json
│   └── package.json
└── package.json              # Root frontend convenience scripts
```

For system boundaries, data relationships, runtime flows, and deployment details, see [Architecture](docs/architecture.md).

## Run locally

### Prerequisites

- Java 21
- Maven 3.9+
- Node.js 20+ and npm
- MySQL 8

### 1. Create the database

```sql
CREATE DATABASE IF NOT EXISTS flowbuddy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

The default local database credentials are `root` / `admin`. Override them with environment variables if your MySQL installation uses different credentials.

### 2. Start the backend

```bash
cd backend
mvn spring-boot:run
```

The API starts at [http://localhost:8080](http://localhost:8080). Hibernate creates or updates the schema, and the bootstrap process creates the super-admin account when it does not already exist.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at [http://localhost:5173](http://localhost:5173).

By default, the frontend client targets the deployed Render backend. To use the local backend, create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8080
```

Restart the Vite development server after changing environment variables.

## Configuration

### Frontend

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | REST and WebSocket backend base URL | Deployed Render API |

### Backend

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `PORT` | No | HTTP server port | `8080` |
| `SPRING_DATASOURCE_URL` | Production | MySQL JDBC connection URL | Local `flowbuddy` database |
| `SPRING_DATASOURCE_USERNAME` | Production | MySQL username | `root` |
| `SPRING_DATASOURCE_PASSWORD` | Production | MySQL password | `admin` |
| `JWT_SECRET` | Production | JWT HMAC signing secret; use at least 32 random bytes | Insecure development value |
| `JWT_TTL_SECONDS` | No | Access-token lifetime | `86400` |
| `CORS_ORIGINS` | Production | Comma-separated trusted frontend origins | Local and live frontends |
| `SEED_SUPER_ADMIN_USERNAME` | No | Initial super-admin username | `super_admin` |
| `SEED_SUPER_ADMIN_PASSWORD` | Production | Initial super-admin password | `super1234!` |
| `UPLOAD_DIR` | No | Local upload fallback directory | `uploads` |
| `CLOUDINARY_URL` | Recommended | Persistent Cloudinary media storage connection URL | Local storage fallback |
| `GEMINI_API_KEY` | For Tasko AI | Google Gemini API key | Disabled |
| `GEMINI_MODEL` | No | Gemini model used by Tasko AI | `gemini-2.5-flash` |
| `LIVEKIT_URL` | For meetings | LiveKit server WebSocket URL | Disabled |
| `LIVEKIT_API_KEY` | For meetings | LiveKit API key | Disabled |
| `LIVEKIT_API_SECRET` | For meetings | LiveKit API secret | Disabled |

The backend also imports an optional `backend/.env.properties` file through Spring configuration. Do not commit secrets.

## Useful commands

Run these from the repository root:

```bash
npm run dev       # Start the Vite development server
npm run build     # Build the frontend for production
```

Run backend commands from `backend/`:

```bash
mvn spring-boot:run
mvn test
mvn clean package
```

## API overview

All protected REST endpoints require:

```http
Authorization: Bearer <jwt>
```

| Area | Main routes |
| --- | --- |
| System | `GET /api/health` |
| Authentication | `POST /api/auth/login`, `GET/PUT /api/auth/me` |
| Users | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{id}` |
| Boards | `GET/POST /api/boards`, `GET/PUT /api/boards/{id}` |
| Columns | `POST /api/boards/{id}/columns`, `PUT/DELETE /api/columns/{id}` |
| Tasks | Board task creation plus `/api/tasks/*` move, edit, assign, comment, and overview operations |
| Chat | `/api/chat/groups`, group messages, search, read state, and `WS /ws/chat` |
| Uploads | `POST /api/uploads`, `GET /uploads/{name}` |
| Notifications | `GET /api/notifications`, per-item and bulk read operations |
| Meetings | `/api/meetings`, LiveKit token generation at `/api/meet/{roomId}/token` |

## Deployment

- **Frontend:** Vercel builds the Vite app from `frontend/` and applies the SPA/API rewrites in `frontend/vercel.json`.
- **Backend:** Render builds `backend/Dockerfile`, checks `/api/health`, and injects production environment variables described in `backend/render.yaml`.
- **Database:** The deployed API expects an externally managed MySQL database.
- **Media:** Configure Cloudinary in production because Render's local filesystem is ephemeral.

## Documentation

- [Architecture and ERD](docs/architecture.md)
- [Backend notes](backend/README.md)
- [Frontend notes](frontend/README.md)
