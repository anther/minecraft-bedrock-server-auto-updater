# Minecraft Bedrock Server Updater - Setup Guide

This guide will help you set up and configure the Minecraft Bedrock Server Updater tool on your Windows system.

## What This Tool Does

The Minecraft Bedrock Server Updater is a PowerShell automation tool that:
- Automatically checks for new Minecraft Bedrock server versions
- Downloads and applies updates to all your server instances
- Preserves your world data and server configurations during updates
- Can run on a schedule via Windows Task Scheduler
- Manages multiple server instances simultaneously

**Important**: This tool updates the Minecraft Bedrock Server software itself. It does NOT configure your servers (game modes, difficulty, player permissions, etc.) - those are managed by Minecraft's own configuration files.

## Prerequisites

Before you begin, ensure you have:

### System Requirements
- **Operating System**: Windows 10 (version 1809 or later) or Windows 11
- **PowerShell**: Version 5.1 or later (pre-installed on modern Windows)
- **Permissions**: Administrator privileges for scheduled tasks
- **Memory**: 2GB RAM minimum per server instance
- **Storage**: 1GB free disk space per server
- **Network**: Internet connection for downloading updates

### Existing Minecraft Servers
You should already have one or more Minecraft Bedrock servers set up. Each server folder must contain:
- `bedrock_server.exe` - The server executable
- `server.properties` - Server configuration
- `permissions.json` - Player permissions
- `allowlist.json` - Player whitelist

If you don't have servers yet, download the Minecraft Bedrock Server from:
https://www.minecraft.net/en-us/download/server/bedrock

---

## Initial Setup

### Step 1: Get the Updater Tool

Clone or download this repository to a location on your computer:

```powershell
# Example location
cd C:\
git clone <repository-url> "Minecraft Servers"
cd "Minecraft Servers"
```

Or download the ZIP file and extract it to your preferred location.

### Step 2: Create Your Configuration File

The updater uses a `configuration.json` file to track the Minecraft version and locate your servers.

Copy the example configuration file:

```powershell
Copy-Item "configuration.json.example" "configuration.json"
```

The configuration file contains:
```json
{
    "currentMinecraftVersion": "1.21.132.3",
    "serverRoot": "./TheServers"
}
```

**Fields explained:**
- `currentMinecraftVersion` - The current Minecraft version. **This is auto-updated by the script**, but you can set it manually if needed
- `serverRoot` - Path to the directory containing your server folders (default: `./TheServers`)

You typically don't need to edit this file manually - the script manages it automatically.

### Step 3: Understand the Directory Structure

The updater tool distinguishes between **code files** (which you manage in git) and **server data** (which should not be tracked):

#### Code Files (Version Controlled)
These are the updater tool files:
- `server update.ps1` - Main update script
- `MinecraftServer.ps1` - Server management class
- `run.bat` - Execution wrapper
- `configuration.json.example` - Configuration template
- `README.md`, `SETUP.md`, `CONFIGURATION.md`, `TROUBLESHOOTING.md` - Documentation

#### Server Data (Not Version Controlled)
These directories contain your Minecraft servers and should be excluded from git:
- `TheServers/` - Your actual server instances
- `Server Backups/` - Manual backups (if you create them)
- `Server Base Files/` - Archived server versions
- `logs/` - Updater execution logs
- `configuration.json` - Auto-generated configuration (excluded from git)

The `.gitignore` file ensures server data isn't accidentally committed to version control.

### Step 4: Place Your Servers

Move or copy your existing Minecraft Bedrock server folders into the `TheServers/` directory:

```
TheServers/
├── MyFirstServer/
│   ├── bedrock_server.exe
│   ├── server.properties
│   ├── permissions.json
│   ├── allowlist.json
│   ├── worlds/
│   └── ... (other Minecraft files)
├── MySecondServer/
│   ├── bedrock_server.exe
│   ├── server.properties
│   └── ... (and so on)
```

**Important**: Each server folder MUST contain these four files:
- `bedrock_server.exe`
- `server.properties`
- `permissions.json`
- `allowlist.json`

The script validates these files exist before managing each server.

**Note**: Make sure each server has unique ports configured in their `server.properties` file:
- First server: `server-port=19132`, `server-portv6=19133`
- Second server: `server-port=19134`, `server-portv6=19135`
- Third server: `server-port=19136`, `server-portv6=19137`
- And so on...

For details on configuring Minecraft servers, see the [official Bedrock server documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers).

### Step 5: Test Manual Execution

Before scheduling automatic updates, test the updater manually:

```powershell
.\run.bat
```

**What should happen:**
1. The script scans the `TheServers` directory
2. Validates each server has required files
3. Checks the Minecraft API for the latest Bedrock server version
4. Downloads the update if a newer version is available (saved to `%TEMP%\MinecraftBedrockUpdate`)
5. Extracts and applies updates to each server
6. Backs up configuration files to a `BACKUP` folder before updating
7. Starts all servers

**Success indicators:**
- Console shows "Found Server Root: [ServerName]" for each server
- No red error messages
- Server windows open (one console window per server)
- Log file created: `logs\MinecraftScriptLog.log`

**If you encounter errors:**
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions
- Check `logs\MinecraftScriptLog.log` for detailed error messages

### Step 6: Schedule Automatic Updates (Recommended)

To keep your servers automatically updated, set up a Windows Task Scheduler task:

#### Open Task Scheduler

Press `Win + R`, type `taskschd.msc`, and press Enter.

#### Create a New Task

1. In Task Scheduler, click **"Create Task"** (not "Create Basic Task") in the right sidebar

#### Configure General Settings

2. **General Tab**:
   - **Name**: `Minecraft Server Updater`
   - **Description**: `Automatically checks for and applies Minecraft Bedrock server updates`
   - **Security options**:
     - Select **"Run whether user is logged on or not"**
     - Check **"Run with highest privileges"**
     - **Configure for**: Windows 10 (or your OS version)

#### Set Up Triggers

3. **Triggers Tab**:
   - Click **"New..."**
   - **Begin the task**: "On a schedule"
   - **Settings**: "Daily"
   - **Start**: Set a time when servers are less active (e.g., 4:00 AM)
   - **Recur every**: 1 day
   - **Enabled**: Checked
   - Click **OK**

#### Configure Actions

4. **Actions Tab**:
   - Click **"New..."**
   - **Action**: "Start a program"
   - **Program/script**: Browse to `run.bat` in your updater directory
     - Example: `C:\Minecraft Servers\run.bat`
   - **Start in**: Enter the updater directory path (without `run.bat`)
     - Example: `C:\Minecraft Servers\`
   - Click **OK**

#### Set Conditions

5. **Conditions Tab**:
   - **Power**: Uncheck "Start the task only if the computer is on AC power" (for desktops)
   - **Network**: Optionally check "Start only if the following network connection is available"
   - Click **OK**

#### Configure Settings

6. **Settings Tab**:
   - Check **"Allow task to be run on demand"** (allows manual execution)
   - Check **"Stop the task if it runs longer than: 1 hour"** (prevents runaway processes)
   - **If the task is already running**: "Do not start a new instance"
   - Click **OK**

#### Save and Test

7. Click **OK** to save the task
8. Enter your Windows password when prompted
9. Right-click the task and select **"Run"** to test it
10. Check `logs\MinecraftScriptLog.log` to verify it executed successfully

---

## How the Updater Works

Understanding the update process helps you troubleshoot issues:

1. **Script Initialization**: Loads `configuration.json` to get current version and server root path
2. **Server Discovery**: Scans `serverRoot` directory for valid Minecraft Bedrock servers
3. **Version Check**: Queries the Minecraft API at `https://net-secondary.web.minecraft-services.net/api/v1.0/download/links`
4. **Download**: If newer version exists, downloads bedrock-server ZIP to temp directory
5. **Extraction**: Extracts new server files, removes config files (they're server-specific)
6. **Server Updates**:
   - Stops running `bedrock_server.exe` processes
   - Backs up `server.properties`, `permissions.json`, `allowlist.json` to `BACKUP/` folder
   - Copies new server files
   - Restores backed-up configuration files
   - Updates `currentVersion.json` in each server folder
7. **Restart**: Starts all servers
8. **Logging**: Records all activity to `MinecraftScriptLog.log` and updates `MinecraftUpdateHistory.json`

---

## Verifying Everything Works

After setup, check these indicators:

### Check Logs

```powershell
# View recent log entries
Get-Content "logs\MinecraftScriptLog.log" -Tail 50
```

Look for entries like:
```
[2026-02-08 14:30:00.000] Found Server Root: MinecraftServer: MyServer creative [Version: 1.21.132.3] [C:\...\TheServers\MyServer] Port:19132, v6:19133
[2026-02-08 14:30:05.000] No update needed - already at version 1.21.132.3
```

### Check Running Servers

```powershell
# List all running Minecraft servers
Get-Process bedrock_server | Format-Table Id, Path, StartTime
```

### Check Version History

```powershell
# View update history
Get-Content "logs\MinecraftUpdateHistory.json" | ConvertFrom-Json | Format-Table
```

---

## Adding New Servers

To add additional servers after initial setup:

1. **Create server folder**:
   ```powershell
   New-Item -ItemType Directory -Path ".\TheServers\NewServerName"
   ```

2. **Copy Minecraft Bedrock server files** to the new folder (bedrock_server.exe, server.properties, etc.)

3. **Edit server.properties**:
   - Set unique `server-name`
   - Set unique `server-port` (e.g., 19138 if you have 3 servers)
   - Set unique `server-portv6` (e.g., 19139)

4. **Run the updater**:
   ```powershell
   .\run.bat
   ```

The script automatically detects new servers on the next run!

---

## What Gets Updated vs What's Preserved

### Updated by the Script
- `bedrock_server.exe` - Server executable
- DLL files and libraries
- Default world templates
- Resource packs
- Documentation files

### Preserved (Never Modified)
- `worlds/` - Your world data
- `server.properties` - Your server configuration
- `permissions.json` - Your operator list
- `allowlist.json` - Your whitelist
- Custom behavior packs
- Custom resource packs

---

## Next Steps

- **Configure firewall rules**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#firewall-configuration) for Windows Firewall commands
- **Set up port forwarding**: Configure your router to forward UDP ports for remote access
- **Learn about configuration options**: See [CONFIGURATION.md](CONFIGURATION.md) for technical details
- **Understand common issues**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for problem-solving

---

## Getting Help

If you encounter issues:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems and solutions
2. Review `logs\MinecraftScriptLog.log` for detailed error messages
3. Verify your setup meets all prerequisites
4. Ensure each server has all required files

For Minecraft server configuration help (not related to this updater):
- [Official Bedrock Server Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers)
- [Minecraft Community Forums](https://www.minecraft.net/en-us/community)
