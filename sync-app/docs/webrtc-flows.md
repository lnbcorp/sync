# WebRTC Signaling Flows

```mermaid
sequenceDiagram
  participant Host
  participant Backend as Signaling Server
  participant Listener

  Host->>Backend: WS join { code }
  Listener->>Backend: WS join { code }
  Note over Backend: Both sockets joined room=code

  Host->>Backend: offer { code, sdp }
  Backend-->>Listener: offer { from: hostId, sdp }

  Listener->>Backend: answer { code, sdp }
  Backend-->>Host: answer { from: listenerId, sdp }

  Host->>Backend: ice-candidate { code, candidate }
  Backend-->>Listener: ice-candidate { from: hostId, candidate }
  Listener->>Backend: ice-candidate { code, candidate }
  Backend-->>Host: ice-candidate { from: listenerId, candidate }
```

## REST Endpoints
- POST `/api/session/create` → `{ code, expiresIn }`
- POST `/api/session/join` → `{ ok: true }`
- POST `/api/session/leave` → `{ ok: true }`

## Room & TTL
- Room name equals 6-digit `code`.
- TTL: 30 minutes refreshed on join.
