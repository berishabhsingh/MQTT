# USP / TR-369 Controller Dashboard for Render

A clean, database-free USP controller dashboard built with **Next.js + Node.js + TypeScript + MQTT**.

It is designed for **Render** and keeps all runtime state in memory:
- broker connection
- discovered devices
- online/offline status
- live logs
- parameter read/write actions
- reconnect logic
- simple username/password login

This version does **not** use Prisma, NextAuth, or any database.

## Why this version

USP over MQTT expects long-lived broker connections. The TR-369 specification describes MQTT sessions as long-lived and reused for subsequent USP record exchange, with retry behavior when the broker connection fails. MQTT 5.0 support is required for endpoints using MQTT as a USP transport, and MQTT over TCP is required for interoperability. citeturn549213search0

Render web services support long-running apps, WebSockets, and require your app to bind on `0.0.0.0` using the `PORT` environment variable. citeturn549213search0

## What you need

Only these environment variables are required:

```env
APP_USERNAME=admin
APP_PASSWORD=change-this-password
JWT_SECRET=change-this-secret
MQTT_BROKER_URL=mqtt://broker.example.com:1883
```

Optional:

```env
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TLS=false
MQTT_REJECT_UNAUTHORIZED=true
USP_CONTROLLER_ID=usp-controller-render
DEVICE_TOPIC_PREFIX=usp
LOG_BUFFER_SIZE=500
DEVICE_OFFLINE_AFTER_MS=180000
```

## Local run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Render deploy

### Method 1: Deploy from GitHub

1. Push this project to GitHub.
2. In Render, click **New > Web Service**.
3. Select your repo.
4. Use:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
5. Set env vars:
   - `APP_USERNAME`
   - `APP_PASSWORD`
   - `JWT_SECRET`
   - `MQTT_BROKER_URL`
   - `MQTT_USERNAME` if needed
   - `MQTT_PASSWORD` if needed
   - `MQTT_TLS` if using TLS
6. Deploy.

### Method 2: Blueprint

This repo includes `render.yaml`. Import the repo into Render and it will prefill service settings.

## Broker / router setup

Your router's USP agent must connect to the same MQTT broker and publish/subscribe on the expected USP topics. This app uses:

- subscribe: `usp/#` by default
- publish to device: `usp/<endpointId>`

Change the prefix using `DEVICE_TOPIC_PREFIX`.

## Notes

- This app keeps runtime data in memory, so logs and discovered devices reset on restart.
- No database is required.
- Login is a simple signed-cookie session using your env username/password.
- Suitable when you want a lightweight personal controller dashboard.

## Local Mosquitto test

Run a broker:

```bash
docker run --name mosquitto -p 1883:1883 -d eclipse-mosquitto:2
```

Then set:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
```

Start the app and point your USP router/agent at that broker.
