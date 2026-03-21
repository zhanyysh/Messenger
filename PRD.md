# Product Requirements Document (PRD): Telegram-like Messenger MVP

## Problem Statement
Users require a modern, reliable, and feature-rich web-based messaging platform that mimics the core utility of Telegram. Existing solutions may be too complex, platform-locked, or lack specific desired features. The goal is to provide a seamless communication tool for individuals and groups that supports text, rich media, and voice notes with robust administrative controls.

## Solution
We will build a responsive web application using **React** for the frontend and **FastAPI (Python)** for the backend. The system will utilize **PostgreSQL** for persistent storage and **WebSockets** for real-time bi-directional communication. The MVP will focus on a polished user experience for 1:1 and group chats, media sharing (images, files, voice notes), and group administration, hosted initially with local file storage designed for easy migration to cloud solutions.

## User Stories

### Authentication & User Profile
1. As a new user, I want to sign up using my email and password so that I can create an account.
2. As a registered user, I want to log in securely so that I can access my chats.
3. As a user, I want to set a profile picture and "Bio" so that others can recognize me.
4. As a user, I want to see my online status (e.g., "Online", "Last seen") so others know my availability.

### 1:1 Chatting
5. As a user, I want to search for other users by their unique username so that I can start a conversation.
6. As a user, I want to send text messages in real-time so that I can communicate instantly.
7. As a user, I want to see a history of my conversation with another user so that I have context.
8. As a user, I want to send emojis in my messages so that I can express emotions better.

### Group Chat & Administration
9. As a user, I want to create a new group with a name and image so that I can chat with multiple people.
10. As a group admin, I want to add members to the group by their username so that the group can grow.
11. As a group admin, I want to remove members from the group so that I can manage the community.
12. As a group admin, I want to promote other members to admins so that they can help manage the group.
13. As a group member, I want to leave a group if I no longer wish to participate.

### Rich Media & Voice
14. As a user, I want to upload and send images so that they appear in the chat stream.
15. As a user, I want to send generic files (documents, PDFs, zips) so that I can share work or data.
16. As a user, I want to record a voice note directly in the chat interface so that I can send audio messages.
17. As a user, I want to play back received voice notes so that I can hear what was said.

### System & UX
18. As a user, I want to see a "typing..." indicator when the other person is writing so that the conversation feels alive.
19. As a user, I want real-time notifications (visual indicators) for new messages even if I'm in a different chat.

## Implementation Decisions

### Architecture
- **Frontend:** React (TypeScript) using a modern build tool (Vite).
  - **State Management:** Zustand or Redux Toolkit for managing chat state and user sessions.
  - **UI Framework:** TailwindCSS + HeadlessUI/RadixUI for a custom, responsive design.
- **Backend:** FastAPI (Python).
  - **Concurrency:** Fully async/await architecture for high-performance WebSocket handling.
  - **API Style:** REST for standard operations (Auth, User Profile, History) + WebSockets for real-time events (New Message, Typing, Status).
- **Database:** PostgreSQL.
  - **ORM:** SQLAlchemy (Async) or Tortoise-ORM.
  - **Schema:** 
    - `Users` (id, email, password_hash, profile_fields)
    - `Chats` (id, type [private/group], meta_info)
    - `Messages` (id, chat_id, sender_id, content, type [text/image/voice], timestamp)
    - `ChatParticipants` (chat_id, user_id, role [admin/member])

### File Storage
- **Strategy:** Abstracted `FileStorageService`.
- **MVP Implementation:** `LocalFileStorage` - saves files to a mounted volume/directory on the server (`/media/uploads/`).
- **Future Proofing:** Interface designed to easily swap in `S3FileStorage` later without changing business logic.

### Authentication
- **Method:** OAuth2 Password Flow (Standard for FastAPI).
- **Token:** JWT (JSON Web Tokens) for stateless authentication.
- **Security:** Passwords hashed using `bcrypt`.

## Testing Decisions

### Backend Testing
- **Framework:** `pytest` + `httpx` (AsyncClient).
- **Scope:**
  - **Unit Tests:** Utility functions, storage abstraction.
  - **Integration Tests:** API endpoints (Auth, CRUD operations).
  - **WebSocket Tests:** specific tests to verify connection handling and message broadcasting.

### Frontend Testing
- **Framework:** Vitest + React Testing Library.
- **Scope:**
  - **Components:** Critical UI components (ChatBubble, InputArea).
  - **Flows:** Login flow, Message sending flow (mocking API).

## Out of Scope
- **End-to-End Encryption (E2EE):** Messages will be encrypted in transit (HTTPS/WSS) but stored plainly (or encrypted at rest) on the database.
- **Real-time Voice/Video Calls:** WebRTC implementation for live calls is postponed for v2.
- **Mobile Native Apps:** Focus is strictly on the responsive web application.
- **Payment Integration:** No paid features or bots for MVP.
- **Complex Search:** Full-text search engine (Elasticsearch) is out of scope; basic SQL `LIKE` queries will suffice for MVP.

## Further Notes
- **Voice Notes:** Will use the MediaRecorder API in the browser to capture audio (likely `.webm` or `.ogg`) and upload as a file to the backend.
- **Design:** Clean, minimalist interface inspired by Telegram Web. Dark mode support should be considered from the start (via Tailwind `dark:` classes).
