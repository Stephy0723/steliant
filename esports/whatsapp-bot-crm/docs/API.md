# API GlitchGang WhatsApp Bot

## Health
GET `/api/health`

## Torneos
GET `/api/tournaments`
GET `/api/tournaments?status=open`
GET `/api/tournaments/:id`

## Equipos
GET `/api/teams`
GET `/api/teams/:name`

## Usuarios por WhatsApp
GET `/api/users/by-phone/:phone`

## Partidas
GET `/api/users/by-phone/:phone/upcoming-match`
GET `/api/users/by-phone/:phone/matches`

## Check-in
POST `/api/checkins`

Body:

```json
{
  "phone": "18095550000",
  "matchId": "match-001"
}
```

Respuesta demo:

```json
{
  "id": "checkin-...",
  "userId": "user-demo-1",
  "matchId": "match-001",
  "checkedInAt": "...",
  "status": "confirmed"
}
```
