# USP Controller Dashboard

This repository contains a production‑ready dashboard for managing **Broadband Forum TR‑369 / User Services Platform (USP)** devices over MQTT.  The application is built with **Next.js**, **Node.js**, **TypeScript**, **MQTT.js**, **Prisma**, and **protobufjs**.  It lets you connect to a USP‑enabled router, discover devices, browse and modify their data models, view live logs, monitor online/offline status, and deploy the entire stack to a persistent hosting environment such as Railway or Render.  The project is intentionally **not** targeted at Vercel, because the USP protocol requires long‑lived MQTT connections which do not suit serverless environments.

## Features

### USP over MQTT

The USP specification defines a flexible message‑transfer protocol (MTP) layer.  When USP runs over MQTT the protocol uses the broker as a message bus: a USP endpoint (agent or controller) negotiates TLS (if required), connects to the broker, subscribes to its topic, and publishes USP records to other endpoints【496331110683351†L3220-L3237】.  The MQTT binding requires USP endpoints to support MQTT 5.0 and recommends MQTT 3.1.1 for backward compatibility【496331110683351†L3241-L3254】.  Connections are intended to be long‑lived and must be re‑established if dropped【496331110683351†L3275-L3287】.  This dashboard includes a TypeScript client that manages the MQTT connection, handles reconnection logic, and uses protobuf definitions (`usp‑record.proto` and `usp‑msg.proto`) to encode/decode USP messages.

### Discovery & Advertisement

USP endpoints learn about each other via discovery and advertisement.  Agents need to know the controller’s endpoint identifier, credentials and at least one MTP (IP address, port and path); controllers need the agent’s endpoint identifier and connectivity information.  That information may be pre‑configured in firmware, configured by an already‑trusted controller, provided via a user interface, or discovered through DHCP, DNS or mDNS【496331110683351†L1784-L1811】.  The dashboard supports manual configuration of the MQTT broker and displays agents as they come online via MQTT.

### CRUD operations & data model browsing

USP defines a reduced set of messages for manipulating device data models.  These include **Add**, **Set**, **Delete**, **Get**, **GetInstances**, **GetSupportedDM**, **GetSupportedProtocol**, **Notify**, **Operate**, and (in USP 1.3) **Register**【53522829703902†L190-L227】.  A `Get` request retrieves the value of one or more parameters in the agent’s data model, while `Set` writes new values; `GetSupportedDM` returns a description of the supported objects and parameters; `GetInstances` lists multi‑instance objects; and `Operate` invokes actions like rebooting or firmware download.  The dashboard exposes these operations through a web UI that lets you browse the device tree, read and modify writable parameters, and call operations.  To facilitate browsing, the USP client uses relative paths and supports addressing objects by their unique keys【53522829703902†L258-L287】.

### Live logs & online/offline monitoring

All USP records exchanged with agents are streamed to the front end via WebSockets.  The UI shows a real‑time log of messages and highlights errors returned by the agent.  The server maintains an in‑memory cache of devices; each time a message from an endpoint is received the `lastSeen` timestamp is updated.  Devices that have not reported within a configurable timeout are marked offline.  If the MQTT connection drops the client attempts to reconnect using exponential back‑off, as recommended by the specification’s retry parameters【496331110683351†L3301-L3327】.

### Authentication & Authorization

The dashboard uses [NextAuth.js](https://next-auth.js.org/) for user authentication (optional – you can disable it for local testing) and Prisma to store user accounts, devices and parameter snapshots.  USP itself supports TLS and certificate‑based authentication between endpoints【496331110683351†L3220-L3237】; the application exposes environment variables to configure MQTT username/password or TLS certificates.  For production deployments you should secure the application with HTTPS and enable authentication.

### Deployment to Railway or Render

The repository contains a **Dockerfile** and sample **docker-compose.yml** that build and run the Next.js server and the Prisma migration.  Railway and Render both provide containers with persistent networking, which is required for long‑lived MQTT sessions.  You can push the Docker image to any registry and deploy to your preferred platform.  Instructions for Railway and Render are included below.

### Local testing with Mosquitto

An example `docker-compose.override.yml` is provided for local development which starts a **Mosquitto** MQTT broker.  You can configure a USP‑enabled router or agent to connect to this broker.  Alternatively, the [open source OB‑USPA agent](https://github.com/BroadbandForum/obuspa) can be used to emulate a device.

## Project structure

```
usp-controller-dashboard/
├── prisma/
│   └── schema.prisma         # Prisma schema (PostgreSQL/SQLite)
├── src/
│   ├── lib/
│   │   └── uspClient.ts      # USP/MQTT client implemented with mqtt.js and protobufjs
│   ├── pages/
│   │   ├── index.tsx         # Next.js dashboard UI
│   │   └── api/
│   │       └── usp/
│   │           ├── connect.ts
│   │           ├── devices.ts
│   │           └── parameters.ts
├── proto/
│   ├── usp-record.proto      # USP record protobuf definition
│   └── usp-msg.proto         # USP message protobuf definition
├── Dockerfile                # Build and run the app
├── docker-compose.yml        # Development services (app + Mosquitto + database)
├── .env.example              # Template for environment variables
└── README.md                 # This documentation
```

## Getting started

### Prerequisites

* **Node.js 18+** and **npm**
* **Docker** and **docker‑compose** for local development
* A USP‑enabled router or the [OB‑USPA](https://github.com/BroadbandForum/obuspa) agent

### Configuration

1. Copy `.env.example` to `.env` and fill in the required values:

   ```bash
   cp .env.example .env
   # edit .env to configure your database, MQTT broker, NextAuth secrets, etc.
   ```

2. (Optional) Modify `prisma/schema.prisma` if you need to adjust the database schema.  Then run the following to create the database and generate the Prisma client:

   ```bash
   npm install
   npx prisma migrate dev --name init
   npx prisma generate
   ```

### Running locally

Start the dashboard, database, and Mosquitto broker using Docker Compose:

```bash
docker-compose up --build
```

The Next.js app will be available at [http://localhost:3000](http://localhost:3000).  Open the page in your browser and enter your MQTT broker settings (host, port, username, password, TLS) in the connection form.  Once connected, any USP‑enabled agent that publishes to the broker will appear under **Devices**.  Click a device to browse its data model, read or write parameters, or call operations.  The **Logs** panel shows all incoming and outgoing USP records.

### Local Mosquitto broker

The included **docker-compose.yml** defines a `mosquitto` service running the Eclipse Mosquitto broker on port 1883.  The default configuration does not require authentication.  To test with a USP agent:

1. Ensure the Mosquitto broker is running: `docker-compose up mosquitto`.
2. Configure your USP agent to use the broker at `localhost:1883`.  In OB‑USPA you can set the environment variables `BROKER=localhost` and `PORT=1883` or modify the agent’s configuration file.
3. Start your agent.  It should connect to the broker and publish/subscribe to its USP topic.  The dashboard will automatically detect the agent and display it under **Devices**.

### Deployment

#### Railway

1. Install the [Railway CLI](https://docs.railway.app/cli) and log in.
2. Create a new project and provision a PostgreSQL database.
3. Create environment variables in the Railway dashboard matching those in `.env.example` (e.g., `DATABASE_URL`, `MQTT_BROKER_URL`, etc.).  Use Railway’s service variables to reference the database connection string.
4. Build and deploy the app using Railway’s Dockerfile deployment:

   ```bash
   railway up
   ```

   Railway will build the Docker image, run Prisma migrations, and start the container.  The MQTT connection will remain active as Railway supports long‑lived TCP connections.

#### Render

1. Sign up at [https://render.com](https://render.com) and create a new **Web Service**.
2. Connect your Git repository and choose **Docker** for the environment.
3. Add environment variables in the **Environment** tab.  Provide `DATABASE_URL`, `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `NEXTAUTH_SECRET`, etc.
4. Deploy.  Render will build and run your container with persistent networking.  You may need to configure health checks to ensure the container stays up while connected to the broker.

## Security considerations

USP transports sensitive device management messages.  In production you should:

* Configure the MQTT broker to require TLS and authentication.  USP clients must implement MQTT over TCP with TLS【496331110683351†L3275-L3287】.
* Use strong `NEXTAUTH_SECRET` values and enable HTTPS for the Next.js server.
* Restrict access to the dashboard with authentication and authorization.  Only authorized users should have the ability to modify device parameters.

## Sources

* The USP specification describes MQTT binding requirements【496331110683351†L3220-L3237】, discovery mechanisms【496331110683351†L1784-L1811】, and retry logic【496331110683351†L3301-L3327】.
* The QA Café overview summarises USP messages such as Get, Set, Add, Delete, GetInstances, GetSupportedDM, Notify, and Operate【53522829703902†L190-L227】.
* See [usp.technology](https://usp.technology) and the [Broadband Forum](https://www.broadband-forum.org/) for the complete standard.
