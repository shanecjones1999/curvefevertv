# Curvefever Backend

Minimal TypeScript backend scaffold for the Curvefever TV project.

Quick start (macOS / Linux):

```bash
cd backend
npm install
npm run dev
```

This starts a small Express + Socket.IO server on port `3001` by default.

## Deploy to Fly.io

The backend includes a `Dockerfile`, `.dockerignore`, and `fly.toml` for Fly.io.

1. Install and authenticate with Fly:

```bash
brew install flyctl
fly auth login
```

2. Create the Fly app from the backend directory:

```bash
cd backend
fly launch --no-deploy
```

If the generated app name in `fly.toml` is unavailable, update `app` to a unique value.

3. Set the frontend origin for CORS:

```bash
fly secrets set CORS_ORIGIN=https://your-frontend-domain
```

4. Deploy:

```bash
fly deploy
```

After deploy, point the frontend at your Fly backend with:

```bash
VITE_BACKEND_URL=https://your-app-name.fly.dev
```
