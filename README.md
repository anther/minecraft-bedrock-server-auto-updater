# Minecraft Bedrock Server Updater

Automated management and version updates for multiple Minecraft Bedrock dedicated servers on Windows using PowerShell.

---

## Overview

This is a PowerShell automation tool that keeps your Minecraft Bedrock servers automatically updated to the latest version. It handles version checking, downloading, updating, and server management with minimal manual intervention.

**Key Features:**
- Automatically detects and installs new Minecraft Bedrock server versions
- Manages multiple server instances simultaneously with individual configurations
- Preserves worlds, player data, and server configurations during updates
- Comprehensive logging and update history tracking
- Scheduled update support via Windows Task Scheduler
- Intelligent caching to avoid redundant downloads

**What This Tool Does**: Updates the Minecraft Bedrock Server executable and libraries
**What This Tool Does NOT Do**: Configure Minecraft servers (gamemode, difficulty, player permissions, etc.)

---

## Quick Start

**For first-time users**: See [SETUP.md](SETUP.md) for complete setup instructions.

**For experienced users**:

```powershell
# 1. Copy configuration template
Copy-Item "configuration.json.example" "configuration.json"

# 2. Place your Minecraft Bedrock servers in TheServers/ directory
#    Each server folder must have: bedrock_server.exe, server.properties, permissions.json, allowlist.json

# 3. Run the updater
.\run.bat
```

---

## Documentation

| Document | Description |
|----------|-------------|
| **[SETUP.md](SETUP.md)** | Complete beginner-friendly setup guide with step-by-step instructions |
| **[CONFIGURATION.md](CONFIGURATION.md)** | Technical reference for configuration files and script architecture |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Common problems and solutions for the updater tool |
| **[LICENSE](LICENSE)** | MIT License information |

---

## System Requirements

- **Operating System**: Windows 10 (1809+), Windows 11, or Windows Server 2019+
- **PowerShell**: Version 5.1 or later (pre-installed on modern Windows)
- **Memory**: 2GB RAM minimum per server instance
- **Storage**: 1GB free disk space per server
- **Network**: Internet connection for downloading updates
- **Permissions**: Administrator privileges (for Task Scheduler setup)

---

## Project Structure

This project separates **code files** (tracked in version control) from **server data** (excluded from git).

### Code Files (Version Controlled)

These files form the updater tool and are tracked in git:

| File | Purpose |
|------|---------|
| [server update.ps1](server update.ps1) | Main orchestration script - handles version checking, downloads, and updates |
| [MinecraftServer.ps1](MinecraftServer.ps1) | PowerShell class for server object representation |
| [run.bat](run.bat) | Execution wrapper that bypasses PowerShell execution policy |
| [configuration.json.example](configuration.json.example) | Template for configuration.json (copy to create active config) |
| README.md, SETUP.md, CONFIGURATION.md, TROUBLESHOOTING.md | Documentation |
| [LICENSE](LICENSE) | MIT License |
| [.gitignore](.gitignore) | Git exclusion patterns |

### Server Data (Excluded from Git)

These directories contain your Minecraft servers and runtime data:

| Directory | Purpose | Tracked in Git? |
|-----------|---------|-----------------|
| `TheServers/` | Active Minecraft Bedrock server instances | No |
| `Server Backups/` | Manual backups (if you create them) | No |
| `Server Base Files/` | Archived server versions for reference | No |
| `logs/` | Updater execution logs and history | No |
| `configuration.json` | Active configuration (auto-modified by script) | No |
| `servers/` | Placeholder directory (currently empty) | Partial* |

\* The `servers/` directory is currently a placeholder. Actual servers are in `TheServers/`.

**Why This Separation Matters**:
- **Clean version control**: Only tool code is tracked, not user data
- **No git conflicts**: Auto-modified files don't create merge issues
- **Privacy**: Server worlds and player data stay local
- **Portability**: Tool can be cloned to any system without bundling server data

See [CONFIGURATION.md#directory-structure](CONFIGURATION.md#directory-structure) for complete directory tree.

---

## How It Works

The updater follows this process:

1. **Initialization**: Loads `configuration.json` to get current version and server root path
2. **Server Discovery**: Scans `TheServers/` for valid Minecraft Bedrock servers
3. **Version Check**: Queries Microsoft's Minecraft API for the latest version
4. **Download**: Downloads new version if available (cached in `%TEMP%`)
5. **Update Servers**:
   - Stops running servers gracefully
   - Backs up configuration files to `BACKUP/` folder
   - Copies new server executables and libraries
   - Restores backed-up configurations
   - Updates version tracking files
6. **Restart**: Starts all updated servers
7. **Logging**: Records all operations to `logs/MinecraftScriptLog.log`

**What Gets Updated**: Server executables, DLLs, libraries
**What's Preserved**: Worlds, server.properties, permissions.json, allowlist.json, player data

---

## Running the Updater

### Manual Execution

```powershell
# Using the batch file (recommended)
.\run.bat

# Or directly via PowerShell
powershell.exe -ExecutionPolicy Bypass -File ".\server update.ps1"
```

### Scheduled Execution (Recommended)

Set up Windows Task Scheduler to run `run.bat` automatically:

1. Open Task Scheduler (`Win + R` → `taskschd.msc`)
2. Create Task with:
   - **Trigger**: Daily at 4:00 AM (or preferred time)
   - **Action**: Start program → `C:\path\to\run.bat`
   - **Settings**: Run with highest privileges

See [SETUP.md#step-6-schedule-automatic-updates](SETUP.md#step-6-schedule-automatic-updates-recommended) for detailed instructions.

---

## Logs and History

The updater maintains detailed logs of all operations:

### MinecraftScriptLog.log

**Location**: `logs\MinecraftScriptLog.log`

Detailed timestamped log of every script execution including:
- Configuration loading
- Server discovery
- Version checks and downloads
- Update operations
- Server start/stop actions
- Errors and warnings

**View recent logs**:
```powershell
Get-Content "logs\MinecraftScriptLog.log" -Tail 50
```

### MinecraftUpdateHistory.json

**Location**: `logs\MinecraftUpdateHistory.json`

Version history with timestamps and update frequency:

```json
[
    {
        "Version": "1.21.132.3",
        "FirstUpdatedAt": "2026-01-16 17:33:25",
        "LastUpdatedAt": "2026-01-16 17:33:25",
        "TimesUpdated": 1
    }
]
```

**View update history**:
```powershell
Get-Content "logs\MinecraftUpdateHistory.json" | ConvertFrom-Json | Format-Table
```

---

## Common Tasks

Useful PowerShell commands for managing the updater:

### Check Status

```powershell
# View current configuration
Get-Content "configuration.json" | ConvertFrom-Json

# List running Minecraft servers
Get-Process bedrock_server | Format-Table Id, StartTime, Path

# Check recent log entries
Get-Content "logs\MinecraftScriptLog.log" -Tail 50
```

### Manage Servers

```powershell
# Stop all servers
Get-Process bedrock_server | Stop-Process

# Check server versions
Get-ChildItem "TheServers\*\currentVersion.json" | ForEach-Object {
    $content = Get-Content $_.FullName | ConvertFrom-Json
    [PSCustomObject]@{
        Server = $_.Directory.Name
        Version = $content.currentVersion
    }
} | Format-Table
```

### Backup

```powershell
# Backup a specific server
$timestamp = Get-Date -Format "yyyy-MM-dd"
Copy-Item "TheServers\YourServerName" "Server Backups\YourServerName_$timestamp" -Recurse
```

---

## Configuration

The updater uses `configuration.json` to track versions and locate servers:

```json
{
    "currentMinecraftVersion": "1.21.132.3",
    "serverRoot": "./TheServers"
}
```

**Fields**:
- `currentMinecraftVersion`: Auto-updated when new version detected (can also be set manually)
- `serverRoot`: Path to directory containing server folders (default: `./TheServers`)

**Setup**: Copy `configuration.json.example` to `configuration.json` before first run.

**Note**: `configuration.json` is automatically modified by the script and should NOT be committed to git.

See [CONFIGURATION.md](CONFIGURATION.md) for complete technical reference.

---

## Adding New Servers

The updater automatically detects servers in the `TheServers/` directory:

1. Create new folder: `TheServers\NewServerName`
2. Copy Minecraft Bedrock server files (bedrock_server.exe, server.properties, etc.)
3. Configure unique ports in `server.properties` (`server-port` and `server-portv6`)
4. Run the updater: `.\run.bat`

**Required files per server**:
- `bedrock_server.exe` - Server executable
- `server.properties` - Server configuration
- `permissions.json` - Player permissions
- `allowlist.json` - Player whitelist

**Note**: Each server must have unique ports to avoid conflicts.

---

## Troubleshooting

Having issues? Check the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) guide for solutions to common problems:

- Script won't run (execution policy)
- "configuration.json not found"
- Missing server files
- Download failures
- Scheduled task not running
- Git conflicts
- And more...

**Quick Diagnostic**:
```powershell
# Check if everything is configured correctly
Test-Path "configuration.json"
Get-Content "configuration.json" | ConvertFrom-Json
Get-Content "logs\MinecraftScriptLog.log" -Tail 20
```

---

## How to Get Help

1. **Check the docs**:
   - [SETUP.md](SETUP.md) - Setup and configuration
   - [CONFIGURATION.md](CONFIGURATION.md) - Technical details
   - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem solving

2. **Check the logs**: `logs\MinecraftScriptLog.log` contains detailed error messages

3. **For Minecraft server issues** (not updater tool issues):
   - [Official Bedrock Server Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers)
   - [Minecraft Community Forums](https://www.minecraft.net/en-us/community)

---

## Features in Detail

### Automatic Version Detection
- Queries Microsoft's Minecraft API for latest Bedrock server version
- Falls back to `configuration.json` version if API is unreachable
- Auto-updates configuration when new version detected

### Multi-Server Management
- Automatically discovers all valid servers in configured directory
- Each server runs with independent configuration
- Supports unlimited server instances (limited by system resources)

### Safe Update Process
- Creates `BACKUP/` folder with config files before updates
- Only updates executable and library files
- Preserves worlds, player data, and configurations
- Skips updates if server already at latest version

### Intelligent Caching
- Downloads update once, applies to all servers
- Caches extracted files in temp directory
- Reuses cache if version matches (speeds up repeated runs)

### Comprehensive Logging
- Every operation is timestamped and logged
- Version history tracking
- Audit trail for all updates

---

## Contributing

Contributions are welcome! Areas for potential improvement:
- Enhanced error handling and recovery
- Web-based management interface
- Automated backup rotation
- Support for multiple server root directories
- Configuration validation and migration tools

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Credits

- **Minecraft Bedrock Server** by Mojang Studios / Microsoft
- **PowerShell Automation** by this project's contributors

---

## Additional Resources

- [Official Minecraft Bedrock Server Download](https://www.minecraft.net/en-us/download/server/bedrock)
- [Bedrock Dedicated Server Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers)
- [Minecraft Community](https://www.minecraft.net/en-us/community)

---

**Need help getting started?** → [SETUP.md](SETUP.md)
**Having problems?** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
**Want technical details?** → [CONFIGURATION.md](CONFIGURATION.md)
