# TaskFlow Architecture

This document describes TaskFlow's current architecture as implemented in this repository. It covers system boundaries, application modules, runtime communication, persistence, security, external integrations, and deployment.

## 1. System summary

TaskFlow uses a client-server architecture:

- A React single-page application owns navigation, presentation, local UI state, REST calls, and real-time client connections.
- A Spring Boot application exposes the REST API, authenticates JWTs, enforces roles, coordinates business operations, persists records through JPA, and hosts native WebSocket endpoints.
- MySQL is the system of record.
- Cloudinary, Google Gemini, and LiveKit are optional external services for durable media, AI chat responses, and audio/video rooms.

### System context

```mermaid
flowchart LR
    User["Team member or administrator"]
    UI["TaskFlow Web App<br/>React + Vite"]
    API["TaskFlow Backend<br/>Spring Boot"]
    DB[("MySQL 8")]
    Cloudinary["Cloudinary<br/>media storage"]
    Gemini["Google Gemini<br/>AI responses"]
    LiveKit["LiveKit<br/>audio/video"]

    User -->|"HTTPS in a browser"| UI
    UI -->|"JSON REST + JWT"| API
    UI <-->|"WSS chat events"| API
    API <-->|"JPA / JDBC"| DB
    API -->|"Authenticated upload API"| Cloudinary
    API -->|"Generate content API"| Gemini
    API -->|"Issues signed room token"| UI
    UI <-->|"WebRTC media + signaling"| LiveKit
```

## 2. Repository and module boundaries

```text
frontend/
  src/main.jsx             Routes, page components, UI state, and feature composition
  src/lib/api.js           Shared fetch wrapper and domain-specific REST clients
  src/styles.css           Core visual system and layouts
  src/features.css         Feature-specific UI styling
  src/chat-fixes.css       Chat layout refinements
  src/meeting.css          Meeting UI styling
  src/realtime.css         Real-time presence and interaction styling

backend/
  api/                     HTTP controllers and request/response DTOs
  bootstrap/               Idempotent startup data seeding
  domain/                  Persistence entities and enums
  repo/                    Spring Data JPA repositories
  security/                JWT parsing, security filter chain, and current principal
  service/                 Gemini integration
  ws/                      Chat and meeting WebSocket handlers and registries
```

The frontend is currently a compact application rather than a feature-folder codebase: most page components live in `main.jsx`, while all network access is centralized in `src/lib/api.js`. The backend follows a conventional controller/repository structure with service classes where an operation integrates with an external system.

## 3. Runtime architecture

### Frontend responsibilities

The React application provides these routes:

| Route | Responsibility |
| --- | --- |
| `/` | Dashboard and workspace overview |
| `/boards` | Board discovery and creation |
| `/boards/:id` | Kanban workflow, columns, tasks, comments, and drag-and-drop |
| `/tasks` | Tasks assigned to or created by the current user |
| `/chat` | Group/direct chat, media, replies, search, and real-time events |
| `/meetings` | Scheduled meeting list and meeting creation |
| `/meetings/:id` | LiveKit meeting room |
| `/notifications` | Notification filters and read state |
| `/admin/users` | Role-protected user administration |
| `/settings` | Profile, theme, avatar, and notification preferences |

`src/lib/api.js` is the boundary between UI components and the backend. It:

1. Resolves `VITE_API_URL`, falling back to the deployed Render service.
2. Reads the JWT from browser local storage.
3. adds the `Authorization: Bearer ...` header.
4. Serializes JSON requests while preserving `FormData` uploads.
5. Clears the local session and emits `taskflow:unauthorized` after an HTTP `401`.
6. Normalizes backend errors into JavaScript exceptions.

### Backend responsibilities

| Backend package | Responsibility |
| --- | --- |
| `api` | REST routing, validation boundary, authorization checks, DTO mapping |
| `security` | BCrypt password hashing, JWT issuance/validation, stateless request authentication, CORS |
| `domain` | JPA entity state and persistence lifecycle defaults |
| `repo` | Query and persistence access through Spring Data |
| `service` | Context assembly and calls to Google Gemini |
| `ws` | Authenticated socket sessions, room/group registries, message and presence broadcasts |
| `bootstrap` | Creates the configured super admin and the `tasko_ai` system user |

### Component view

```mermaid
flowchart TB
    subgraph Browser["Browser"]
        Router["React Router"]
        Pages["Feature pages and components"]
        Client["API client"]
        Socket["WebSocket client"]
        LKClient["LiveKit client"]
        Storage["localStorage<br/>JWT + session"]

        Router --> Pages
        Pages --> Client
        Pages --> Socket
        Pages --> LKClient
        Client <--> Storage
        Socket <--> Storage
    end

    subgraph Spring["Spring Boot process"]
        Filter["JWT authentication filter"]
        Controllers["REST controllers"]
        Security["Authorization rules"]
        Repositories["JPA repositories"]
        ChatWS["Chat WebSocket handler"]
        MeetWS["Meeting WebSocket handler"]
        GeminiService["Gemini assistant service"]
        UploadService["Upload controller"]

        Filter --> Security --> Controllers
        Controllers --> Repositories
        ChatWS --> Repositories
        Controllers --> GeminiService
        Controllers --> UploadService
    end

    Client -->|"HTTPS"| Filter
    Socket <-->|"WSS"| ChatWS
    Socket <-->|"WSS"| MeetWS
    Repositories <--> MySQL[("MySQL")]
    GeminiService --> Gemini["Gemini API"]
    UploadService --> Cloudinary["Cloudinary or local disk"]
    LKClient <-->|"WebRTC"| LiveKit["LiveKit"]
```

## 4. Core request flows

### Login and authenticated REST request

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant Auth as AuthController
    participant JWT as JWT service/filter
    participant DB as MySQL

    User->>UI: Submit username and password
    UI->>Auth: POST /api/auth/login
    Auth->>DB: Find user by username
    DB-->>Auth: User and BCrypt password hash
    Auth->>Auth: Verify password and active state
    Auth->>JWT: Sign JWT
    JWT-->>UI: Token and user session
    UI->>UI: Store token/session in localStorage
    UI->>JWT: Protected REST request + Bearer token
    JWT->>JWT: Verify signature and expiration
    JWT->>Auth: Populate authenticated principal
    Auth->>DB: Execute operation
    DB-->>UI: JSON response
```

Authentication is stateless. The server does not create an HTTP session; every protected request carries its JWT.

### Real-time group message

```mermaid
sequenceDiagram
    actor Sender
    participant UI as Chat UI
    participant REST as ChatController
    participant DB as MySQL
    participant WS as ChatSocketRegistry
    participant Peers as Connected group members
    participant AI as GeminiAssistantService

    Sender->>UI: Send message
    UI->>REST: POST /api/chat/groups/{id}/messages
    REST->>DB: Persist message
    REST->>WS: Broadcast message event
    WS-->>Peers: WebSocket message
    REST-->>UI: Created message
    opt Message mentions @tasko_ai
        REST->>AI: Request asynchronous answer
        AI->>DB: Load recent group context
        AI->>AI: Generate answer with Gemini
        AI->>DB: Persist bot reply
        AI->>WS: Broadcast bot reply
        WS-->>Peers: WebSocket message
    end
```

The WebSocket endpoint is `/ws/chat?token=<jwt>&group=<group-id>`. The socket authenticates the token at connection time and registers the connection under the requested chat group. Message creation itself uses REST; WebSocket is the fan-out channel for new messages and transient events such as typing.

### Video meeting join

```mermaid
sequenceDiagram
    actor User
    participant UI as Meeting room UI
    participant API as MeetController
    participant DB as MySQL
    participant LK as LiveKit

    User->>UI: Open /meetings/{roomId}
    UI->>API: GET /api/meet/{roomId}/token
    API->>DB: Load meeting and verify participant
    API->>API: Check meeting time window
    API->>API: Sign short-lived LiveKit room token
    API-->>UI: LiveKit URL and token
    UI->>LK: Connect with signed token
    LK-->>UI: WebRTC media and participant events
```

Only the organizer and listed participants can obtain a room token. Scheduled rooms open 15 minutes early and expire two hours after their scheduled start according to the current controller logic.

## 5. Data architecture

TaskFlow uses Hibernate with `spring.jpa.hibernate.ddl-auto=update`. The model uses UUID primary keys throughout.

Several relations are represented as UUID fields or `@ElementCollection` join tables instead of JPA entity associations. The ERD below therefore shows **logical application relationships**; not every line implies a database-level foreign-key constraint generated by the current mappings.

### Entity-relationship diagram

```mermaid
erDiagram
    USERS {
        UUID id PK
        string username UK
        string password_hash
        string first_name
        string last_name
        string email
        string github_url
        string linkedin_url
        string avatar_url
        boolean notifications_enabled
        string theme
        enum role
        boolean active
        timestamp created_at
    }

    BOARDS {
        UUID id PK
        string name
        string description
        UUID owner_id
        boolean archived
        timestamp created_at
    }

    BOARD_COLUMNS {
        UUID id PK
        UUID board_id
        string name
        int position
    }

    TASKS {
        UUID id PK
        UUID board_id
        UUID column_id
        string title
        string description
        int position
        enum priority
        UUID assignee_id
        UUID created_by_id
        timestamp due_date
        timestamp created_at
    }

    TASK_COMMENTS {
        UUID id PK
        UUID task_id
        UUID author_id
        string content
        timestamp created_at
    }

    BOARD_FAVORITES {
        UUID board_id
        UUID user_id
    }

    TASK_ASSIGNEES {
        UUID task_id
        UUID user_id
    }

    CHAT_GROUPS {
        UUID id PK
        string name
        string description
        string avatar_url
        boolean direct
        timestamp created_at
    }

    CHAT_GROUP_MEMBERS {
        UUID group_id
        UUID user_id
    }

    CHAT_MESSAGES {
        UUID id PK
        UUID group_id
        UUID sender_id
        string content
        enum type
        string meet_room_id
        string media_url
        string media_name
        UUID reply_to_id
        timestamp created_at
    }

    CHAT_MESSAGE_MENTIONS {
        UUID message_id
        UUID user_id
    }

    CHAT_READ_STATES {
        UUID id PK
        UUID group_id
        UUID user_id
        UUID last_read_message_id
        UUID scroll_message_id
        timestamp last_read_at
    }

    MEETINGS {
        UUID id PK
        string room_id UK
        string title
        string description
        UUID organizer_id
        timestamp scheduled_at
        int duration_minutes
        timestamp created_at
    }

    MEETING_PARTICIPANTS {
        UUID meeting_id
        UUID user_id
    }

    NOTIFICATIONS {
        UUID id PK
        UUID user_id
        string text
        string type
        UUID resource_id
        string action_url
        boolean is_read
        timestamp created_at
    }

    USERS ||--o{ BOARDS : owns
    BOARDS ||--o{ BOARD_COLUMNS : contains
    BOARDS ||--o{ TASKS : contains
    BOARD_COLUMNS ||--o{ TASKS : organizes
    USERS ||--o{ TASKS : creates
    TASKS ||--o{ TASK_COMMENTS : has
    USERS ||--o{ TASK_COMMENTS : writes
    BOARDS ||--o{ BOARD_FAVORITES : receives
    USERS ||--o{ BOARD_FAVORITES : marks
    TASKS ||--o{ TASK_ASSIGNEES : has
    USERS ||--o{ TASK_ASSIGNEES : receives
    CHAT_GROUPS ||--o{ CHAT_GROUP_MEMBERS : contains
    USERS ||--o{ CHAT_GROUP_MEMBERS : joins
    CHAT_GROUPS ||--o{ CHAT_MESSAGES : contains
    USERS ||--o{ CHAT_MESSAGES : sends
    CHAT_MESSAGES o|--o{ CHAT_MESSAGES : replies_to
    CHAT_MESSAGES ||--o{ CHAT_MESSAGE_MENTIONS : contains
    USERS ||--o{ CHAT_MESSAGE_MENTIONS : receives
    CHAT_GROUPS ||--o{ CHAT_READ_STATES : tracks
    USERS ||--o{ CHAT_READ_STATES : owns
    USERS ||--o{ MEETINGS : organizes
    MEETINGS ||--o{ MEETING_PARTICIPANTS : includes
    USERS ||--o{ MEETING_PARTICIPANTS : attends
    USERS ||--o{ NOTIFICATIONS : receives
```

### Main invariants

- Usernames and meeting room IDs are unique.
- Chat read state is unique for each `(groupId, userId)` pair.
- Board columns and tasks carry integer positions for ordering.
- A task belongs to one board and one workflow column.
- A task supports a legacy single `assigneeId` plus the current multi-user `task_assignees` collection.
- Chat messages can reply to another message and mention multiple users.
- Chat message types are `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `FILE`, `MEET_INVITE`, or `SYSTEM`.
- Task priorities are `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- User roles are `SUPER_ADMIN`, `ADMIN`, or `MEMBER`.

## 6. Security model

### Authentication

- Passwords are stored as BCrypt hashes.
- `POST /api/auth/login` returns a signed JWT.
- `JwtAuthFilter` validates protected requests and constructs the current principal.
- JWT lifetime defaults to 86,400 seconds.
- Authentication state is stored by the browser in local storage.

### Authorization

- Public HTTP routes include `/`, `/api/health`, `/api/auth/login`, `/uploads/**`, and the WebSocket handshake paths.
- All other routes require authentication.
- Creating or deleting users requires `SUPER_ADMIN` or `ADMIN`.
- The frontend also hides `/admin/users` from unauthorized roles, but backend authorization remains the security boundary.
- Feature controllers perform resource-level checks such as chat membership and meeting participation.
- WebSocket handshakes are publicly routable but validate the JWT supplied in the query string before accepting application activity.

### Production requirements

- Replace all development credentials.
- Set a cryptographically random `JWT_SECRET`.
- Restrict `CORS_ORIGINS` to trusted HTTPS origins.
- Keep database, Cloudinary, Gemini, and LiveKit secrets outside version control.
- Terminate all browser traffic over HTTPS/WSS.
- Consider moving browser tokens from local storage to a hardened cookie strategy if the threat model requires stronger resistance to token theft through XSS.

## 7. External integrations

| Integration | Purpose | Failure behavior |
| --- | --- | --- |
| Cloudinary | Durable chat and avatar media | Without configuration, uploads fall back to local disk |
| Google Gemini | Context-aware `@tasko_ai` chat replies | The assistant posts a configuration/unavailable response |
| LiveKit | Audio/video meeting transport | Token endpoint returns `503 Service Unavailable` when unconfigured |
| DiceBear | Generated fallback avatars | Browser loads avatar SVGs directly from DiceBear |

Local upload fallback is useful for development. It is not durable on an ephemeral Render filesystem, so Cloudinary should be configured for the deployed service.

## 8. Deployment topology

```mermaid
flowchart TB
    Browser["User browser"]

    subgraph Vercel["Vercel"]
        Static["Vite production bundle"]
        Rewrites["SPA fallback and API/upload rewrites"]
    end

    subgraph Render["Render · Frankfurt"]
        Container["TaskFlow Docker container<br/>Java 21 JRE"]
        Disk["Ephemeral local uploads"]
    end

    DB[("Managed MySQL")]
    Cloudinary["Cloudinary"]
    Gemini["Google Gemini"]
    LiveKit["LiveKit Cloud / Server"]

    Browser -->|"HTTPS"| Static
    Static --> Rewrites
    Browser -->|"HTTPS REST + WSS"| Container
    Rewrites -.->|"Fallback proxy routes"| Container
    Container -->|"JDBC/TLS"| DB
    Container --> Disk
    Container -->|"Optional"| Cloudinary
    Container -->|"Optional"| Gemini
    Browser -->|"Optional WebRTC"| LiveKit
    Container -->|"Signed access token"| LiveKit
```

| Deployment concern | Implementation |
| --- | --- |
| Frontend build | Vercel runs the Vite build and serves `dist/` |
| SPA routing | `frontend/vercel.json` rewrites unmatched paths to `index.html` |
| Backend build | Multi-stage Maven/Temurin Docker image |
| Runtime port | Render provides `PORT`; the blueprint sets `10000` |
| Health check | Render requests `/api/health` |
| Database schema | Hibernate updates the schema on application startup |
| CORS | Explicit environment-driven allowlist |
| Persistent media | Cloudinary is preferred; container disk is a fallback |

### Live endpoints

- Web application: [https://taskflow-app-umber-ten.vercel.app](https://taskflow-app-umber-ten.vercel.app/)
- Backend service: [https://taskflow-backend-ivsy.onrender.com](https://taskflow-backend-ivsy.onrender.com/)
- Health endpoint: [https://taskflow-backend-ivsy.onrender.com/api/health](https://taskflow-backend-ivsy.onrender.com/api/health)

Render free services can take time to wake after inactivity. A slow first API request does not necessarily indicate a frontend failure.

## 9. Operational characteristics

- The REST tier is stateless with respect to authentication and can be replicated behind a load balancer.
- Chat and meeting socket registries are currently in process memory. Horizontal scaling would require sticky connections and/or a shared pub/sub layer such as Redis.
- Hibernate schema auto-update favors rapid iteration. Versioned migrations with Flyway or Liquibase would make production schema changes more deterministic.
- Local media storage is tied to one backend instance. Cloudinary removes that instance affinity.
- The AI response task is asynchronous inside the application process. A durable queue would improve retry and recovery behavior at larger scale.
- There is no separate caching tier; reads go directly through JPA to MySQL.

## 10. Extension points

The clearest next architectural improvements are:

1. Split `frontend/src/main.jsx` into route and feature modules as the UI grows.
2. Add versioned database migrations and disable automatic schema mutation in production.
3. Introduce Redis pub/sub for WebSocket fan-out across multiple backend instances.
4. Add an OpenAPI contract and generated/typed frontend API models.
5. Move asynchronous AI work to a durable job queue with timeout, retry, and observability.
6. Add structured logs, metrics, tracing, and error reporting around external integrations.
7. Add automated backend integration tests and frontend end-to-end coverage for critical user journeys.
