# Troubleshooting Guide

This guide helps you solve common issues with the Minecraft Bedrock Server Updater tool.

**Important Notes**:
- This guide covers problems with the **updater tool itself**, not Minecraft server configuration or gameplay issues. For Minecraft server help, see the [official Bedrock documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers).
- **All commands should be run from the `minecraft-server-manager/` directory** unless otherwise specified.
- Server data (TheServers/, Server Backups/) is located in the parent/root directory (`../` from minecraft-server-manager/).

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Diagnostic Commands](#diagnostic-commands)
- [Preventive Maintenance](#preventive-maintenance)

---

## Quick Diagnostics

Before diving into specific issues, run these quick checks:

```powershell
# 1. Check if configuration exists
Test-Path "configuration.json"

# 2. Validate configuration JSON
Get-Content "configuration.json" | ConvertFrom-Json

# 3. Check recent logs
Get-Content "logs\MinecraftScriptLog.log" -Tail 20

# 4. List running servers
Get-Process bedrock_server -ErrorAction SilentlyContinue

# 5. Check PowerShell version (should be 5.1+)
$PSVersionTable.PSVersion
```

---

## Common Issues

### 1. Script Won't Run - Execution Policy Error

**Symptom**:
When running the PowerShell script directly, you see:
```
File cannot be loaded because running scripts is disabled on this system
```

**Cause**: PowerShell execution policy blocks unsigned scripts

**Solution**:

**Option A**: Use `run.bat` (Recommended)
```powershell
.\run.bat
```
The batch file automatically bypasses execution policy restrictions.

**Option B**: Change execution policy (Requires Administrator)
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run the script
.\server update.ps1
```

**Option C**: One-time bypass
```powershell
powershell.exe -ExecutionPolicy Bypass -File ".\server update.ps1"
```

---

### 2. "configuration.json not found"

**Symptom**:
Script exits immediately with error message about missing configuration.json

**Cause**: The configuration file doesn't exist

**Solution**:

Copy the template file:
```powershell
Copy-Item "configuration.json.example" "configuration.json"
```

If `configuration.json.example` doesn't exist either, create the file manually:
```powershell
@"
{
    "currentMinecraftVersion": "1.21.132.3",
    "serverRoot": "../TheServers"
}
"@ | Out-File "configuration.json" -Encoding UTF8
```

---

### 3. "Not Server Root: Missing [file] in [path]"

**Symptom**:
Log shows: `Not Server Root: Missing bedrock_server.exe in C:\...\ServerName`

**Cause**: Server folder is missing required files

**Solution**:

Each server folder must contain ALL of these files:
- `bedrock_server.exe`
- `server.properties`
- `permissions.json`
- `allowlist.json`

**Check what's missing**:
```powershell
$serverPath = "TheServers\YourServerName"
@("bedrock_server.exe", "server.properties", "permissions.json", "allowlist.json") | ForEach-Object {
    $exists = Test-Path "$serverPath\$_"
    "$_ : $exists"
}
```

**Fix**:

1. If server is incomplete, copy missing files from a complete Bedrock server download
2. For empty JSON files, create them:
   ```powershell
   # Create empty permissions.json
   "[]" | Out-File "TheServers\YourServer\permissions.json" -Encoding UTF8

   # Create empty allowlist.json
   "[]" | Out-File "TheServers\YourServer\allowlist.json" -Encoding UTF8
   ```

---

### 4. Failed Download - Network Errors

**Symptom**:
```
ERROR: Failed to download bedrock-server-1.21.132.3.zip
```

**Possible Causes & Solutions**:

#### A. No Internet Connection
**Check**:
```powershell
Test-Connection www.minecraft.net -Count 2
```

**Fix**: Ensure computer has internet access

#### B. Minecraft API Down
**Check**: Visit https://www.minecraft.net/en-us/download/server/bedrock in your browser

**Fix**: Wait and retry later. The script will use the version in `configuration.json` as fallback.

#### C. Disk Space Full
**Check**:
```powershell
Get-PSDrive C | Select-Object Used, Free
```

**Fix**: Free up disk space, especially in `%TEMP%` directory

#### D. Proxy/Firewall Blocking
**Fix**: Configure PowerShell to use your proxy:
```powershell
$proxy = [System.Net.WebRequest]::GetSystemWebProxy()
$proxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
[System.Net.WebRequest]::DefaultWebProxy = $proxy
```

---

### 5. Scheduled Task Not Running

**Symptom**:
Task shows "Ready" in Task Scheduler but never executes, or logs show no recent activity

**Diagnosis Steps**:

1. **Check task history**:
   - Open Task Scheduler (`taskschd.msc`)
   - Select your task
   - Click "History" tab
   - Look for error codes

2. **Check last run result**:
   - Right-click task → Properties
   - Check "Last Run Result" code
   - `0x0` = Success
   - Other codes = errors

**Common Fixes**:

#### A. Task Disabled
**Fix**: Right-click task → Enable

#### B. Wrong Path in Action
**Check**: Task Properties → Actions tab

**Should be**:
- **Program/script**: Full path to `run.bat` (e.g., `C:\Minecraft Servers\minecraft-server-manager\run.bat`)
- **Start in**: Directory path without filename (e.g., `C:\Minecraft Servers\minecraft-server-manager\`)

**Fix**: Edit action with correct paths (use Browse button)

#### C. Permissions Issue
**Fix**: Task Properties → General tab
- Check "Run with highest privileges"
- Ensure "Run whether user is logged on or not" is selected
- Re-enter your Windows password when saving

#### D. Account Password Changed
**Fix**: Right-click task → Properties → General tab → Re-enter your Windows password

#### E. Trigger Not Enabled
**Fix**: Task Properties → Triggers tab → Edit trigger → Ensure "Enabled" is checked

**Test Manually**:
```powershell
# Run task immediately
Start-ScheduledTask -TaskName "Minecraft Server Updater"

# Check logs after 1 minute
Get-Content "logs\MinecraftScriptLog.log" -Tail 20
```

---

### 6. "No update needed" but Server Version is Old

**Symptom**:
Script says "No update needed" but your server is running an older version

**Cause**: `configuration.json` and/or server's `currentVersion.json` have incorrect version

**Solution**:

1. **Delete version tracking files**:
   ```powershell
   # Remove global version tracking
   Remove-Item "configuration.json"
   Copy-Item "configuration.json.example" "configuration.json"

   # Remove per-server version tracking
   Get-ChildItem "TheServers\*\currentVersion.json" | Remove-Item
   ```

2. **Run updater**:
   ```powershell
   .\run.bat
   ```

The script will detect the version mismatch and update.

---

### 7. Git Shows configuration.json as Modified

**Symptom**:
`git status` always shows configuration.json as modified

**Cause**: The file is tracked in git but auto-modified by the script

**Solution**:

This should already be fixed if you're using the latest version. If not:

1. **Add to .gitignore**:
   ```powershell
   Add-Content ".gitignore" "`nconfiguration.json"
   ```

2. **Remove from git tracking** (keeps file locally):
   ```powershell
   git rm --cached configuration.json
   git add .gitignore
   git commit -m "Stop tracking auto-generated configuration.json"
   ```

---

### 8. Script Hangs or Runs Forever

**Symptom**:
Script starts but never completes, or scheduled task shows "Running" for hours

**Cause**: Usually a network timeout or stuck process

**Solution**:

1. **Stop the running script**:
   ```powershell
   # Find PowerShell processes running the script
   Get-Process powershell | Where-Object {
       $_.MainWindowTitle -like "*server update*"
   } | Stop-Process
   ```

2. **Check for stuck downloads**:
   - Look in `%TEMP%\MinecraftBedrockUpdate\`
   - Delete partially downloaded files
   - Retry

3. **Add to Task Scheduler** (if using scheduled task):
   - Settings tab → "Stop the task if it runs longer than: 1 hour"

---

### 9. Servers Not Starting After Update

**Symptom**:
Script completes but server windows don't open, or close immediately

**Diagnosis**:

1. **Check logs**:
   ```powershell
   Get-Content "logs\MinecraftScriptLog.log" -Tail 50
   ```

2. **Try starting manually**:
   ```powershell
   cd "TheServers\YourServer"
   .\bedrock_server.exe
   ```
   Watch for errors in the server console

**Common Causes**:

#### A. Port Already in Use
**Check**:
```powershell
netstat -ano | findstr "19132"
```

**Fix**: Stop other servers using that port, or change port in `server.properties`

#### B. Corrupted Server Files
**Fix**: Re-download fresh Bedrock server and re-run updater

#### C. Antivirus Blocking
**Fix**: Add `bedrock_server.exe` to antivirus exclusions

---

### 10. "Access Denied" Errors

**Symptom**:
Script can't copy files, start servers, or modify directories

**Solutions**:

1. **Close server windows**:
   ```powershell
   Get-Process bedrock_server | Stop-Process -Force
   ```

2. **Run as Administrator**:
   - Right-click PowerShell → "Run as Administrator"
   - Then run `.\run.bat`

3. **Check file permissions**:
   - Right-click project folder → Properties → Security
   - Ensure your user has "Full Control"

4. **Disable antivirus temporarily** to test if it's interfering

---

## Diagnostic Commands

Use these PowerShell commands to gather information for troubleshooting.

### System Information

```powershell
# PowerShell version (should be 5.1+)
$PSVersionTable.PSVersion

# Operating System
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsHardwareAbstractionLayer

# Available disk space
Get-PSDrive C | Select-Object Used, Free

# Memory available
Get-ComputerInfo | Select-Object OsTotalVisibleMemorySize, OsFreePhysicalMemory
```

### Updater Tool Status

```powershell
# Check configuration
Get-Content "configuration.json" | ConvertFrom-Json

# Validate JSON syntax
try {
    Get-Content "configuration.json" | ConvertFrom-Json | Out-Null
    "Valid JSON"
} catch {
    "Invalid JSON: $_"
}

# Check server root exists
$config = Get-Content "configuration.json" | ConvertFrom-Json
Test-Path $config.serverRoot

# Count detected servers
(Get-ChildItem $config.serverRoot -Directory).Count
```

### Server Status

```powershell
# List all running Minecraft servers
Get-Process bedrock_server -ErrorAction SilentlyContinue | Format-Table Id, StartTime, Path

# Check server ports
Get-NetTCPConnection -LocalPort 19132 -ErrorAction SilentlyContinue
Get-NetUDPEndpoint -LocalPort 19132 -ErrorAction SilentlyContinue

# List all servers with their versions
Get-ChildItem "TheServers\*\currentVersion.json" -ErrorAction SilentlyContinue | ForEach-Object {
    $version = Get-Content $_.FullName | ConvertFrom-Json
    [PSCustomObject]@{
        Server = $_.Directory.Name
        Version = $version.currentVersion
        LastUpdated = $version.lastUpdated
    }
} | Format-Table
```

### Log Analysis

```powershell
# View last 50 log entries
Get-Content "logs\MinecraftScriptLog.log" -Tail 50 -ErrorAction SilentlyContinue

# Search for errors
Get-Content "logs\MinecraftScriptLog.log" -ErrorAction SilentlyContinue |
    Select-String "error|fail|exception" -CaseSensitive:$false

# View today's logs
$today = Get-Date -Format "yyyy-MM-dd"
Get-Content "logs\MinecraftScriptLog.log" -ErrorAction SilentlyContinue |
    Select-String $today

# View update history
Get-Content "logs\MinecraftUpdateHistory.json" -ErrorAction SilentlyContinue |
    ConvertFrom-Json | Format-Table
```

### Network Connectivity

```powershell
# Test internet connection
Test-Connection www.minecraft.net -Count 4

# Test Minecraft API access
try {
    $response = Invoke-RestMethod -Uri "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links"
    "API accessible - Latest version: $($response.windows.version)"
} catch {
    "API error: $_"
}

# Check proxy settings
[System.Net.WebRequest]::DefaultWebProxy.GetProxy("https://www.minecraft.net")
```

---

## Preventive Maintenance

Regular maintenance helps prevent issues before they occur.

### Weekly Maintenance

```powershell
# 1. Check logs for errors
Get-Content "logs\MinecraftScriptLog.log" -Tail 100 |
    Select-String "error|warning" -CaseSensitive:$false

# 2. Verify all servers are running
$expectedServers = (Get-ChildItem "TheServers" -Directory).Count
$runningServers = (Get-Process bedrock_server -ErrorAction SilentlyContinue).Count
"Expected: $expectedServers, Running: $runningServers"

# 3. Check disk space
Get-PSDrive C | Format-Table Name, Used, Free

# 4. Review update history
Get-Content "logs\MinecraftUpdateHistory.json" | ConvertFrom-Json |
    Select-Object -First 5 | Format-Table
```

### Monthly Maintenance

```powershell
# 1. Verify scheduled task is working
$task = Get-ScheduledTask -TaskName "Minecraft Server Updater" -ErrorAction SilentlyContinue
$task | Format-List TaskName, State, LastRunTime, LastTaskResult

# 2. Check log file size
$logSize = (Get-Item "logs\MinecraftScriptLog.log").Length / 1MB
"Log file size: $([math]::Round($logSize, 2)) MB"

# 3. Test manual update
Write-Host "Running manual update test..."
.\run.bat

# 4. Archive old logs (if log is very large)
$timestamp = Get-Date -Format "yyyy-MM-dd"
Copy-Item "logs\MinecraftScriptLog.log" "logs\MinecraftScriptLog_archive_$timestamp.log"
Clear-Content "logs\MinecraftScriptLog.log"
```

### Best Practices

1. **Always backup before manual changes**:
   ```powershell
   $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
   Copy-Item "TheServers\YourServer" "Server Backups\YourServer_$timestamp" -Recurse
   ```

2. **Test on one server first** when making configuration changes:
   - Temporarily move other servers out of `TheServers`
   - Run update on single server
   - Verify functionality
   - Move other servers back

3. **Monitor Task Scheduler**:
   - Check task history monthly
   - Ensure "Last Run Result" is `0x0` (success)
   - Verify "Next Run Time" is scheduled correctly

4. **Keep documentation updated**:
   - Document custom changes to server configurations
   - Note any script modifications
   - Track server port assignments

---

## Getting Additional Help

If you've tried everything in this guide and still have issues:

1. **Gather diagnostic information**:
   ```powershell
   # Create diagnostic report
   @"
   Diagnostic Report - $(Get-Date)

   PowerShell Version: $($PSVersionTable.PSVersion)
   OS: $(Get-ComputerInfo | Select-Object -ExpandProperty WindowsProductName)

   Configuration:
   $(Get-Content "configuration.json")

   Recent Logs:
   $(Get-Content "logs\MinecraftScriptLog.log" -Tail 30)

   Running Servers:
   $(Get-Process bedrock_server -ErrorAction SilentlyContinue | Format-Table | Out-String)
   "@ | Out-File "diagnostic-report.txt"
   ```

2. **Check the documentation**:
   - [SETUP.md](SETUP.md) - Setup instructions
   - [CONFIGURATION.md](CONFIGURATION.md) - Technical reference
   - [README.md](README.md) - Project overview

3. **Minecraft Server Issues** (not updater tool issues):
   - [Official Bedrock Server Documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/dedicatedservers)
   - [Minecraft Community Forums](https://www.minecraft.net/en-us/community)
   - Reddit: r/MinecraftBedrock, r/admincraft

4. **PowerShell Issues**:
   - [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/powershell)

---

## Emergency Recovery

If everything is broken and you need to start fresh:

### Complete Reset

```powershell
# 1. Stop all servers
Get-Process bedrock_server | Stop-Process -Force

# 2. Backup your worlds
New-Item -ItemType Directory -Path ".\EMERGENCY_BACKUP" -Force
Copy-Item "TheServers\*\worlds" "EMERGENCY_BACKUP\" -Recurse

# 3. Reset configuration
Remove-Item "configuration.json" -Force
Copy-Item "configuration.json.example" "configuration.json"

# 4. Clean temp directory
Remove-Item "$env:TEMP\MinecraftBedrockUpdate" -Recurse -Force -ErrorAction SilentlyContinue

# 5. Clear logs
Clear-Content "logs\MinecraftScriptLog.log" -ErrorAction SilentlyContinue

# 6. Remove version tracking
Get-ChildItem "TheServers\*\currentVersion.json" | Remove-Item -Force

# 7. Run fresh update
.\run.bat

# 8. Verify worlds are intact
Get-ChildItem "TheServers\*\worlds" -Directory
```

### Reinstall Server

If a specific server is corrupted:

```powershell
$serverName = "YourServerName"

# 1. Backup world
Copy-Item "TheServers\$serverName\worlds" ".\BACKUP_$serverName" -Recurse

# 2. Backup configs
Copy-Item "TheServers\$serverName\server.properties" ".\BACKUP_$serverName\"
Copy-Item "TheServers\$serverName\permissions.json" ".\BACKUP_$serverName\"
Copy-Item "TheServers\$serverName\allowlist.json" ".\BACKUP_$serverName\"

# 3. Download fresh Bedrock server
# (from https://www.minecraft.net/en-us/download/server/bedrock)

# 4. Replace server files (keep configs and worlds)
# Extract downloaded ZIP, copy everything EXCEPT worlds/ folder

# 5. Restore configs
Copy-Item "BACKUP_$serverName\*" "TheServers\$serverName\" -Exclude "worlds"
```

---

Remember: When in doubt, check the logs first! Most issues leave clear traces in `logs\MinecraftScriptLog.log`.
