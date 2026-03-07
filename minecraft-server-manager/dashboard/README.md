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
