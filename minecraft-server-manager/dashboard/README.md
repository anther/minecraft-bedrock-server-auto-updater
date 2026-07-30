# Dashboard (Optional)

A local web dashboard that displays status and history for your Minecraft Bedrock servers. No npm packages required — runs on Node.js built-in modules only.

## Quick Start

```powershell
cd minecraft-server-manager
.\dashboard.bat
```

Then open **http://localhost:19100** in your browser.

## What It Shows

- **Current Minecraft version** from `configuration.json`
- **Server status** for each server: name, version, gamemode, ports, online/offline
- **Update history** from `logs/MinecraftUpdateHistory.json`
- **Recent logs** (last 50 lines) from `logs/MinecraftScriptLog.log`

Data auto-refreshes every 30 seconds.

## Restarting Servers

Each server card has a **Restart** button, and the header has **Restart All**. A restart force-stops the server's `bedrock_server.exe`, rotates its console logs, and relaunches it (picking up any `server.properties` changes). Both prompt for confirmation first.

> **Note:** the dashboard can only stop/start servers when it runs in the **same or higher privilege level** as the `bedrock_server.exe` processes. If the servers were launched elevated (e.g. from an elevated scheduled task), run the dashboard elevated too, or the restart buttons can't see or control them.

## Troubleshooting: a server shows offline but is actually running

The dashboard detects "online" by sending a Bedrock LAN ping and waiting for a reply. A server only replies when **`enable-lan-visibility=true`** in its `server.properties`. So:

- **`enable-lan-visibility=false` → the server runs fine but shows as offline/unresponsive here**, and it won't appear in Minecraft's **LAN / Friends** tab. (Players can still join by **Add Server → IP:port** directly.) If a restart "seems to do nothing," check this first — the server probably *did* restart; it just isn't broadcasting.
- **Never assign port `19132` as a server's `server-port`.** `19132` is Bedrock's fixed **LAN-discovery** port: when `enable-lan-visibility=true`, every server tries to bind it for discovery and the first one to start wins. A server whose *gameplay* port is `19132` will then fail to start with `Port [19132] may be in use ... Exiting program`. Use `19133`+ for gameplay and leave `19132` for discovery.

## Requirements

- Node.js installed and available on PATH

## Configuration

The dashboard port defaults to **19100**. Override it with the `DASHBOARD_PORT` environment variable:

```powershell
set DASHBOARD_PORT=8080
node dashboard\server.js
```

## Network Access

To access the dashboard from other computers on your network:

1. Open `http://<your-ip>:19100` from the other machine
2. Add a Windows Firewall inbound rule allowing TCP port **19100** on the **Private** profile

## Run on Startup (Optional)

Use Windows Task Scheduler:

1. Open Task Scheduler (`Win + R` → `taskschd.msc`)
2. Create Task:
   - **Trigger**: At startup
   - **Action**: Start program → `node`, arguments: `dashboard\server.js`
   - **Start in**: `C:\path\to\minecraft-server-manager\`
   - **Settings**: Uncheck "Stop the task if it runs longer than", set "Do not start a new instance"
