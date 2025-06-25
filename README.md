# Minecraft Bedrock Server Updater

This project automates the management and version updates of multiple Minecraft Bedrock servers on Windows using PowerShell. It supports scheduled updates, version tracking, logging, and per-server management.

---

## Features

- Automatically checks for and installs new Minecraft Bedrock server versions
- Maintains multiple server instances with individual ports and settings
- Keeps a history of version updates
- Logs all script activity
- Avoids redundant downloads or restarts if servers are already up to date

---

## Setup

1. **Extract the repository somewhere safe.**
2. **Place your server folders** inside the root directory (e.g., `Earth/`, `SurvivalIsland/`).  
   These must each contain:
    - `bedrock_server.exe`
    - `permissions.json`
    - `allowlist.json`
    - `server.properties`

3. **Schedule the updater** to run daily (or on demand) using Task Scheduler:
    - Use `run.bat` as the task action to ensure PowerShell bypasses execution policy restrictions.

---

## Running the Updater

You can run the update script manually via:

`run.bat`
Or directly in PowerShell:


powershell.exe -ExecutionPolicy Bypass -File ".\server update.ps1"

To keep the window open after errors, edit run.bat like so:
```
powershell.exe -ExecutionPolicy Bypass -File ".\server update.ps1"
pause
```


## Logs & History
MinecraftScriptLog.log: Detailed logs from each run.

MinecraftUpdateHistory.json: Version history with timestamps and update counts.

configuration.json: Currently installed Minecraft version.

## Adding New Servers
Simply add the minecraft server to the servers directory.
The script will detect it automatically during the next run.