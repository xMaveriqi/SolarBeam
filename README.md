# Solar Beam

Sistema de irrigacao automatizada com ESP32, API em Node.js e dashboard web.

## Estrutura

```
solarbeam/
├── api/    -> Backend (Node.js + Express + Turso), deploy no Render
└── web/    -> Frontend (HTML/CSS/JS puro), deploy no Netlify
```

## Deploy

**API (Render)**
- Root Directory: `api`
- Build Command: `npm install`
- Start Command: `npm start`
- Variaveis de ambiente: `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SETUP_SECRET`

**Web (Netlify)**
- Base directory: `web`
- Sem build command (site estatico)
- Publish directory: `web`

A URL da API usada pelo frontend fica em `web/js/config.js`.
