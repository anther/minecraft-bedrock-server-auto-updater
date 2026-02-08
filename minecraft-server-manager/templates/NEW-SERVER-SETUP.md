# Quick Reference: Adding a New Server

This is a quick checklist for adding a new Minecraft Bedrock server to the updater. For detailed instructions, see [SETUP.md](../SETUP.md#adding-new-servers).

## Prerequisites

- [ ] You have an existing Minecraft Bedrock server or have downloaded the server files from https://www.minecraft.net/en-us/download/server/bedrock
- [ ] The updater tool is already set up (configuration.json exists)
- [ ] You know which ports are available (check existing servers to avoid conflicts)

## Quick Steps

### 1. Create Server Folder

```powershell
# Replace "NewServerName" with your desired server name
New-Item -ItemType Directory -Path ".\TheServers\NewServerName"
```

### 2. Copy Required Files

Copy these files from your Minecraft Bedrock server download into the new folder:

**Required Files** (updater will not detect server without these):
- [ ] `bedrock_server.exe` - Server executable
- [ ] `server.properties` - Server configuration
- [ ] `permissions.json` - Player permissions (can be empty: `[]`)
- [ ] `allowlist.json` - Player whitelist (can be empty: `[]`)

**Also Copy** (for complete server):
- [ ] `bedrock_server.pdb` - Debug symbols
- [ ] All `.dll` files - Required libraries
- [ ] `worlds/` folder - If you have an existing world
- [ ] `behavior_packs/`, `resource_packs/`, `structures/` - If you have custom content

```powershell
# Example: Copy from downloaded Bedrock server
$source = "C:\Downloads\bedrock-server-1.21.132.3"
$dest = ".\TheServers\NewServerName"
Copy-Item "$source\*" "$dest\" -Recurse -Exclude "worlds"
```

### 3. Configure Server Settings

Edit `TheServers\NewServerName\server.properties`:

**Critical Settings to Change**:
```properties
# Server name (shown in server list)
server-name=NewServerName

# Ports MUST be unique per server
server-port=19132        # Change if 19132 is already used
server-portv6=19133      # Change if 19133 is already used
```

**Port Assignment Guide**:
| Server # | IPv4 Port | IPv6 Port |
|----------|-----------|-----------|
| 1st server | 19132 | 19133 |
| 2nd server | 19134 | 19135 |
| 3rd server | 19136 | 19137 |
| 4th server | 19138 | 19139 |
| 5th server | 19140 | 19141 |

**Other Common Settings**:
```properties
gamemode=survival        # survival, creative, or adventure
difficulty=normal        # peaceful, easy, normal, or hard
max-players=10           # Maximum concurrent players
allow-cheats=false       # Enable/disable commands
online-mode=true         # Require Xbox Live authentication
allow-list=false         # Enable/disable whitelist
```

For all available settings, see the [official Bedrock documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers).

### 4. Create Empty JSON Files (if needed)

If you don't have permissions.json or allowlist.json:

```powershell
$serverPath = ".\TheServers\NewServerName"

# Create empty permissions.json
"[]" | Out-File "$serverPath\permissions.json" -Encoding UTF8 -NoNewline

# Create empty allowlist.json
"[]" | Out-File "$serverPath\allowlist.json" -Encoding UTF8 -NoNewline
```

### 5. Run the Updater

The updater will automatically detect the new server on the next run:

```powershell
.\run.bat
```

**What happens**:
1. Script scans TheServers/ directory
2. Detects new server folder
3. Validates required files exist
4. Applies any pending updates
5. Starts the server

### 6. Verify Server is Running

```powershell
# List all running Minecraft servers
Get-Process bedrock_server | Format-Table Id, StartTime, Path

# Check if your new server is in the list
Get-Process bedrock_server | Where-Object {
    $_.Path -like "*NewServerName*"
}

# Check recent logs
Get-Content "logs\MinecraftScriptLog.log" -Tail 30 | Select-String "NewServerName"
```

### 7. Configure Firewall (for remote access)

```powershell
# Allow your server's ports through Windows Firewall
# Replace 19132 with your actual server-port
New-NetFirewallRule -DisplayName "Minecraft Server - NewServerName" `
    -Direction Inbound -Protocol UDP -LocalPort 19132 -Action Allow
```

### 8. Configure Router Port Forwarding (for internet access)

Access your router admin panel (usually 192.168.1.1 or 192.168.0.1) and:

1. Find **Port Forwarding** or **Virtual Server** section
2. Add forwarding rule:
   - **Service Name**: Minecraft NewServerName
   - **Protocol**: UDP
   - **External Port**: Your server-port (e.g., 19132)
   - **Internal Port**: Same as external port
   - **Internal IP**: Your PC's local IP address
3. Save the configuration

## Troubleshooting New Server Setup

### Server Not Detected

**Symptom**: Updater doesn't find the new server

**Check**:
```powershell
$serverPath = ".\TheServers\NewServerName"
@("bedrock_server.exe", "server.properties", "permissions.json", "allowlist.json") | ForEach-Object {
    $exists = Test-Path "$serverPath\$_"
    [PSCustomObject]@{
        File = $_
        Exists = $exists
    }
} | Format-Table
```

**Fix**: Ensure all four required files exist.

### Server Won't Start

**Symptom**: Server window opens and immediately closes

**Common causes**:
1. **Port already in use**
   ```powershell
   # Check if port is available
   netstat -ano | findstr "19132"
   ```
   Fix: Change `server-port` to an unused port

2. **Invalid JSON in permissions.json or allowlist.json**
   ```powershell
   # Validate JSON syntax
   Get-Content "TheServers\NewServerName\permissions.json" | ConvertFrom-Json
   Get-Content "TheServers\NewServerName\allowlist.json" | ConvertFrom-Json
   ```
   Fix: Ensure valid JSON format (at minimum: `[]`)

3. **Missing DLL files**
   - Fix: Copy all DLL files from Bedrock server download

### Can't Connect to Server

**Local network players can't connect**:
- Check Windows Firewall allows UDP port
- Verify server is running: `Get-Process bedrock_server`
- Check server.properties has correct port

**Internet players can't connect**:
- Verify port forwarding is configured on router
- Provide players with your public IP address (find at https://whatismyip.com)
- Check `online-mode=true` in server.properties (requires Xbox Live)

## Quick Reference Commands

```powershell
# Stop all servers
Get-Process bedrock_server | Stop-Process

# Stop specific server
Get-Process bedrock_server | Where-Object {
    $_.Path -like "*NewServerName*"
} | Stop-Process

# Check server version
Get-Content "TheServers\NewServerName\currentVersion.json" | ConvertFrom-Json

# View server console logs (if logging enabled in server.properties)
Get-Content "TheServers\NewServerName\*.log" -Tail 50

# Backup server before making changes
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
Copy-Item "TheServers\NewServerName" "Server Backups\NewServerName_$timestamp" -Recurse
```

## Additional Resources

- [SETUP.md](../SETUP.md) - Complete setup documentation
- [CONFIGURATION.md](../CONFIGURATION.md) - Technical reference
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Problem solving guide
- [Official Bedrock Server Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers) - Minecraft configuration help

---

**Tip**: Always backup your server before making changes: `Copy-Item "TheServers\ServerName" "Server Backups\ServerName_backup" -Recurse`
