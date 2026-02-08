# Configuration Reference

This document provides technical reference information for the Minecraft Bedrock Server Updater tool's configuration files, architecture, and operational details.

## Table of Contents

- [configuration.json](#configurationjson)
- [Directory Structure](#directory-structure)
- [Script Architecture](#script-architecture)
- [Log Files](#log-files)
- [Version Tracking](#version-tracking)
- [Advanced Configuration](#advanced-configuration)

---

## configuration.json

The main configuration file for the updater tool located at the project root.

### File Location
`C:\Users\Janther\Downloads\Minecraft Servers\minecraft-server-manager\configuration.json`

### Format
```json
{
    "currentMinecraftVersion": "1.21.132.3",
    "serverRoot": "../TheServers"
}
```

### Fields

#### currentMinecraftVersion
- **Type**: String
- **Format**: `Major.Minor.Patch.Build` (e.g., `"1.21.132.3"`)
- **Auto-updated**: Yes
- **Purpose**: Tracks the currently installed Minecraft Bedrock Server version

**Behavior**:
- Automatically updated when the script detects a newer version from the Minecraft API
- Used as a fallback version if the API is unreachable
- Modified by `server update.ps1` lines 159-162 when new version detected
- Triggers download when value doesn't match API version

**Manual Editing**:
Generally not needed, but you can manually set this if:
- Working offline without API access
- Need to force a specific version
- Recovering from a corrupted state

**API Source**: https://net-secondary.web.minecraft-services.net/api/v1.0/download/links

#### serverRoot
- **Type**: String (path)
- **Default**: `"../TheServers"`
- **Purpose**: Specifies the directory containing server instance folders
- **Path Types**:
  - **Relative**: `../TheServers`, `../../MyServers`, `../servers`
  - **Absolute**: `C:\MinecraftServers`, `D:\Games\Minecraft\Servers`

**Behavior**:
- Script scans this directory for valid server folders
- Each subdirectory is checked for required files:
  - `bedrock_server.exe`
  - `server.properties`
  - `permissions.json`
  - `allowlist.json`
- Folders missing required files are skipped with a log message
- Path must exist before running the script (not auto-created)

**Example Configurations**:
```json
# Default - servers in parent directory's TheServers folder
{"serverRoot": "../TheServers"}

# Absolute path
{"serverRoot": "C:\\MinecraftServers"}

# Different drive
{"serverRoot": "D:\\Servers\\Minecraft"}

# Custom relative path
{"serverRoot": "../../OtherLocation\\Servers"}
```

### Version Control Note

**Important**: `configuration.json` should NOT be committed to git because it's automatically modified by the script. The repository includes `configuration.json.example` as a template instead.

The `.gitignore` file excludes `configuration.json` to prevent git conflicts.

---

## Directory Structure

Complete breakdown of the project structure with distinction between code and data.

### Overview

The project is organized to separate **application code** (in `minecraft-server-manager/`) from **server data** (in root directory):

```
Minecraft Servers/                        # Root directory
│
├── minecraft-server-manager/             # Application code (git tracked)
│   ├── server update.ps1                 # Main update orchestration script
│   ├── MinecraftServer.ps1               # Server class definition
│   ├── run.bat                           # PowerShell execution wrapper
│   ├── configuration.json.example        # Configuration template (tracked in git)
│   ├── configuration.json                # Active configuration (auto-generated, gitignored)
│   ├── README.md                         # Project overview and navigation
│   ├── SETUP.md                          # Beginner-friendly setup guide
│   ├── CONFIGURATION.md                  # This file - technical reference
│   ├── TROUBLESHOOTING.md                # Problem-solving guide
│   ├── LICENSE                           # MIT License
│   ├── .gitignore                        # Git exclusion patterns
│   │
│   ├── logs/                             # Updater execution logs (gitignored)
│   │   ├── MinecraftScriptLog.log        # Detailed execution log
│   │   └── MinecraftUpdateHistory.json   # Version update history
│   │
│   ├── servers/                          # Placeholder directory
│   │   └── server directories go here.txt
│   │
│   └── templates/                        # Helper documentation
│       └── NEW-SERVER-SETUP.md
│
├── TheServers/                           # Server data (not tracked in git)
│   ├── Earth/
│   │   ├── bedrock_server.exe
│   │   ├── server.properties
│   │   ├── permissions.json
│   │   ├── allowlist.json
│   │   ├── currentVersion.json           # Per-server version tracking
│   │   ├── BACKUP/                       # Config backups before updates
│   │   ├── worlds/
│   │   ├── behavior_packs/
│   │   ├── resource_packs/
│   │   └── ... (other Minecraft files)
│   ├── SledgeMountain/
│   ├── SledgerCreative/
│   ├── SledgerSurvival/
│   └── SurvivalIsland/
│
├── Server Backups/                       # Manual backups (not tracked)
│   └── ... (user-created backups)
│
└── Server Base Files/                    # Archived versions (not tracked)
    └── ... (archived server files)
```

### Application Code (minecraft-server-manager/)

All updater tool code lives in the `minecraft-server-manager/` subdirectory. These files are tracked in git:

| File | Purpose |
|------|---------|
| `server update.ps1` | Main orchestration script - handles version checking, downloads, server updates |
| `MinecraftServer.ps1` | PowerShell class definition for server object representation |
| `run.bat` | Execution wrapper that bypasses PowerShell execution policy |
| `configuration.json.example` | Template for configuration.json |
| `logs/` | Updater execution logs and history (gitignored) |
| `servers/` | Placeholder directory (gitignored) |
| `templates/` | Helper documentation |
| `README.md`, `SETUP.md`, `CONFIGURATION.md`, `TROUBLESHOOTING.md` | Documentation files |
| `LICENSE` | MIT License file |
| `.gitignore` | Defines what to exclude from version control |

### Server Data (Root Directory)

Server data remains in the root directory, separate from application code. NOT tracked in git:

| Directory | Purpose | Location |
|-----------|---------|----------|
| `TheServers/` | Active server instances with worlds and configurations | `../TheServers/` (from code dir) |
| `Server Backups/` | User-created manual backups | `../Server Backups/` (from code dir) |
| `Server Base Files/` | Archived server versions | `../Server Base Files/` (from code dir) |

### Why This Structure?

1. **Clear separation**: Application code in one directory, server data in another
2. **Clean version control**: Only code and templates are tracked, no user data
3. **Prevents conflicts**: Auto-modified config doesn't create merge conflicts
4. **Privacy**: Server worlds and player data stay local
5. **Portability**: Clone the manager, point it at any server directory
6. **Easier updates**: Pull code changes without affecting server data

---

## Script Architecture

Technical breakdown of how the updater tool works.

### Core Components

#### server update.ps1

**Purpose**: Main orchestration script that manages the entire update process

**Key Sections**:

1. **Configuration Loading** (Lines ~1-30)
   ```powershell
   $configPath = ".\configuration.json"
   $config = Get-Content $configPath | ConvertFrom-Json
   $version = $config.currentMinecraftVersion
   $serverRoot = $config.serverRoot
   ```

2. **Server Discovery** (Lines ~31-100)
   - Scans `serverRoot` directory
   - Validates each folder has required files
   - Creates `MinecraftServer` objects for valid servers
   - Uses `MinecraftServer.ps1` class

3. **Version Checking** (Lines ~101-150)
   - Queries Minecraft API for latest version
   - Compares with `currentMinecraftVersion`
   - Falls back to config version if API fails
   ```powershell
   $apiUrl = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links"
   $response = Invoke-RestMethod -Uri $apiUrl
   $latestVersion = $response.windows.version
   ```

4. **Download Logic** (Lines ~151-200)
   - Downloads bedrock-server ZIP if newer version exists
   - Saves to `$env:TEMP\MinecraftBedrockUpdate\`
   - Caches downloads to avoid re-downloading

5. **Extraction** (Lines ~201-250)
   - Extracts ZIP to temp directory
   - Removes configuration files from extracted version
   - Skips extraction if version matches cached

6. **Server Update Process** (Lines ~251-350)
   - For each server:
     - Stops running `bedrock_server.exe` process (via WMI)
     - Creates `BACKUP/` folder
     - Backs up `server.properties`, `permissions.json`, `allowlist.json`
     - Copies new server files from extracted source
     - Restores backed-up configuration files
     - Updates `currentVersion.json`

7. **Server Restart** (Lines ~351-400)
   - Starts all servers using `Start-Process`
   - Launches each `bedrock_server.exe`

8. **Logging & History** (Lines ~401-end)
   - Writes to `MinecraftScriptLog.log`
   - Updates `MinecraftUpdateHistory.json`

**Error Handling**:
- Exits if `configuration.json` not found
- Logs warnings for invalid server folders
- Continues on individual server failures
- Records all operations to log

#### MinecraftServer.ps1

**Purpose**: PowerShell class that represents a Minecraft Bedrock server instance

**Class Definition**:
```powershell
class MinecraftServer {
    [string]$Name
    [string]$Path
    [string]$Version
    [int]$Port
    [int]$PortV6
    [string]$GameMode

    # Constructor
    MinecraftServer([string]$path) {
        # Load server.properties
        # Parse configuration
        # Set properties
    }

    # Methods for server management
    [bool]IsRunning() { ... }
    [void]Stop() { ... }
    [void]Start() { ... }
    [void]Backup() { ... }
}
```

**Properties**:
- `Name`: Server folder name (e.g., "Earth", "SurvivalIsland")
- `Path`: Full path to server directory
- `Version`: Current Minecraft version from `currentVersion.json`
- `Port`: IPv4 port from `server.properties`
- `PortV6`: IPv6 port from `server.properties`
- `GameMode`: Game mode (survival, creative, adventure)

**Methods**:
- Validation: Checks required files exist
- Process management: Start/stop server processes
- Property loading: Parses `server.properties` file

#### run.bat

**Purpose**: Simple execution wrapper for Windows Task Scheduler compatibility

**Contents**:
```batch
@echo off
powershell.exe -ExecutionPolicy Bypass -File ".\server update.ps1"
```

**Why It Exists**:
- Bypasses PowerShell execution policy restrictions
- Provides consistent execution from Task Scheduler
- No need for users to modify PowerShell execution policy

---

## Log Files

The updater maintains detailed logs of all operations.

### MinecraftScriptLog.log

**Location**: `logs\MinecraftScriptLog.log`

**Purpose**: Detailed timestamped log of every script execution

**Format**:
```
[YYYY-MM-DD HH:MM:SS.fff] Message
```

**Content**:
- Configuration loading
- Server discovery and validation
- API calls and version checks
- Download operations
- File operations (copy, backup, extract)
- Server start/stop operations
- Error messages and warnings

**Example Log Entries**:
```
[2026-02-08 14:30:00.123] Using serverRoot path: C:\Users\Janther\Downloads\Minecraft Servers\TheServers
[2026-02-08 14:30:00.145] Searching for Server Roots by searching for existence of files: bedrock_server.exe, permissions.json, allowlist.json, server.properties
[2026-02-08 14:30:00.167] Found Server Root: MinecraftServer: Earth creative [Version: 1.21.132.3] [C:\...\TheServers\Earth] Port:19132, v6:19133
[2026-02-08 14:30:05.234] No update needed - already at version 1.21.132.3
```

**Log Rotation**:
- Not implemented - file grows indefinitely
- Manual cleanup recommended if file becomes very large
- Consider archiving old logs periodically

**Reading Logs**:
```powershell
# View all logs
Get-Content "logs\MinecraftScriptLog.log"

# View last 50 lines
Get-Content "logs\MinecraftScriptLog.log" -Tail 50

# Search for errors
Get-Content "logs\MinecraftScriptLog.log" | Select-String "error" -CaseSensitive:$false

# View logs from specific date
Get-Content "logs\MinecraftScriptLog.log" | Select-String "2026-02-08"
```

### MinecraftUpdateHistory.json

**Location**: `logs\MinecraftUpdateHistory.json`

**Purpose**: Tracks version update history with timestamps and frequency

**Format**: JSON array of version objects
```json
[
    {
        "Version": "1.21.132.3",
        "FirstUpdatedAt": "2026-01-16 17:33:25",
        "LastUpdatedAt": "2026-01-16 17:33:25",
        "TimesUpdated": 1
    },
    {
        "Version": "1.21.130.2",
        "FirstUpdatedAt": "2026-01-10 04:00:00",
        "LastUpdatedAt": "2026-01-15 04:00:00",
        "TimesUpdated": 6
    }
]
```

**Fields**:
- `Version`: Minecraft Bedrock Server version string
- `FirstUpdatedAt`: Timestamp when this version was first installed
- `LastUpdatedAt`: Timestamp of most recent run for this version
- `TimesUpdated`: How many times the script has processed this version

**Use Cases**:
- Track update frequency (how often script runs)
- Verify version history
- Monitor update patterns
- Audit version changes

**Reading History**:
```powershell
# View formatted history
Get-Content "logs\MinecraftUpdateHistory.json" | ConvertFrom-Json | Format-Table

# Get latest version entry
$history = Get-Content "logs\MinecraftUpdateHistory.json" | ConvertFrom-Json
$history | Select-Object -First 1

# Count total updates
($history | Measure-Object -Property TimesUpdated -Sum).Sum
```

---

## Version Tracking

The updater tracks versions at multiple levels.

### Global Version (configuration.json)

```json
{
    "currentMinecraftVersion": "1.21.132.3"
}
```

- Represents the version the updater downloaded/extracted
- Updated when new version detected from API
- Used for download decisions

### Per-Server Version (currentVersion.json)

**Location**: Each server folder (e.g., `TheServers\Earth\currentVersion.json`)

**Format**:
```json
{
    "currentVersion": "1.21.132.3",
    "lastUpdated": "2026-01-16T17:33:25"
}
```

**Purpose**:
- Tracks when each specific server was last updated
- Allows per-server update verification
- Created/updated during server update process

### Version Flow

1. Script checks global `configuration.json` version
2. Queries API for latest version
3. If newer version exists:
   - Updates `configuration.json`
   - Downloads new server files
   - Updates each server's `currentVersion.json`
4. Records update in `MinecraftUpdateHistory.json`

---

## Advanced Configuration

### Changing Server Root Directory

Edit `configuration.json` to point to a different location:

```json
{
    "serverRoot": "D:\\MyMinecraftServers"
}
```

**Requirements**:
- Path must exist before running script
- Use double backslashes (`\\`) in Windows paths in JSON
- Can be relative or absolute

**After Changing**:
- Script will scan the new location on next run
- Previous server location is no longer managed
- Consider moving server folders to new location

### Offline Operation

If the Minecraft API is unavailable, the script falls back to using `currentMinecraftVersion` from `configuration.json`.

**To Force Offline Mode**:
1. Set desired version in `configuration.json`
2. Manually download bedrock-server ZIP
3. Place in `%TEMP%\MinecraftBedrockUpdate\` with expected filename
4. Run script - will use cached ZIP

### Multiple Updater Instances

You can run multiple independent updater instances:

1. Clone repository to different directories
2. Each has its own `configuration.json`
3. Point `serverRoot` to different server locations
4. Schedule separately in Task Scheduler

**Example**:
- `C:\MinecraftUpdater1\` → manages production servers in `D:\ProdServers\`
- `C:\MinecraftUpdater2\` → manages test servers in `D:\TestServers\`

### Custom Update Schedule

Modify Task Scheduler trigger for different update frequencies:

- **Hourly**: For active development servers
- **Daily** (4 AM): Standard production (recommended)
- **Weekly**: For stable, low-traffic servers
- **On startup**: Auto-start servers on system boot
- **Manual only**: Disable schedule, run `run.bat` manually

---

## Command Reference

Useful PowerShell commands for working with the updater.

### Check Configuration

```powershell
# View current configuration
Get-Content "configuration.json" | ConvertFrom-Json

# Validate JSON syntax
Get-Content "configuration.json" | ConvertFrom-Json | Format-List
```

### Monitor Servers

```powershell
# List running Minecraft servers
Get-Process bedrock_server | Format-Table Id, Path, StartTime, CPU

# Stop all servers
Get-Process bedrock_server | Stop-Process -Force

# Check server ports
netstat -ano | findstr "19132"
```

### Log Analysis

```powershell
# View recent activity
Get-Content "logs\MinecraftScriptLog.log" -Tail 100

# Search for errors
Select-String -Path "logs\MinecraftScriptLog.log" -Pattern "error|fail|exception" -Context 2

# Export logs to file
Get-Content "logs\MinecraftScriptLog.log" | Out-File "exported-logs.txt"
```

### Version Information

```powershell
# Check PowerShell version
$PSVersionTable.PSVersion

# Check .NET Framework version
[System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription

# View server versions
Get-ChildItem "TheServers\*\currentVersion.json" | ForEach-Object {
    $content = Get-Content $_.FullName | ConvertFrom-Json
    [PSCustomObject]@{
        Server = $_.Directory.Name
        Version = $content.currentVersion
        LastUpdated = $content.lastUpdated
    }
} | Format-Table
```

---

## Technical Notes

### API Endpoint

**URL**: https://net-secondary.web.minecraft-services.net/api/v1.0/download/links

**Response Format**:
```json
{
    "windows": {
        "version": "1.21.132.3",
        "url": "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.132.3.zip"
    },
    "linux": { ... },
    "preview": { ... }
}
```

**TLS Requirements**:
- Script enables TLS 1.0, 1.1, 1.2 for compatibility
- HTTPS required for API calls

### Process Management

The script uses Windows Management Instrumentation (WMI) to manage server processes:

```powershell
# Find running server
$process = Get-WmiObject Win32_Process -Filter "name='bedrock_server.exe' AND CommandLine LIKE '%ServerPath%'"

# Stop server
$process.Terminate()
```

### Backup Strategy

Before each server update:
1. Creates `BACKUP/` folder in server directory
2. Copies current `server.properties`, `permissions.json`, `allowlist.json`
3. Overwrites files from new Minecraft version
4. Restores backed-up configs

**Backup Retention**:
- Only one backup kept (most recent)
- Previous backups are overwritten
- Consider manual backups before major updates

---

## See Also

- [SETUP.md](SETUP.md) - Setup instructions
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [README.md](README.md) - Project overview
