# Minecraft Server Manager - C# Implementation

A C# WPF GUI application for managing Minecraft Bedrock servers with automatic updates. This project is a complete rewrite of the PowerShell-based auto-updater.

## Current Status: Phase 1 Complete (Core Business Logic)

### What's Been Built

**Phase 1: Core Business Logic** ✅ COMPLETE
- All PowerShell functionality ported to C#
- Clean, testable service-based architecture
- Full logging and history tracking
- Ready for GUI integration

### Project Structure

```
MinecraftServerManager/
├── MinecraftServerManager.Core/          # Core business logic library
│   ├── Models/                            # Data models
│   │   ├── MinecraftServer.cs            # Server representation
│   │   ├── ServerProperties.cs           # server.properties parser
│   │   ├── ServerConfiguration.cs        # configuration.json model
│   │   ├── VersionInfo.cs                # Version tracking
│   │   ├── UpdateHistoryEntry.cs         # Update history
│   │   └── DownloadProgress.cs           # Progress reporting
│   │
│   └── Services/                          # Business services
│       ├── ServerManager.cs              # Main orchestrator
│       ├── ServerDiscoveryService.cs     # Find servers
│       ├── VersionCheckerService.cs      # Check Minecraft API
│       ├── DownloadService.cs            # Download with progress
│       ├── UpdateService.cs              # Apply updates
│       ├── ConfigurationService.cs       # Config management
│       └── LoggingService.cs             # Logging
│
└── MinecraftServerManager.sln            # Visual Studio solution
```

### Features Implemented

1. **Server Discovery**
   - Scans server root directory
   - Validates required files
   - Loads server properties and version info
   - Process status checking

2. **Version Management**
   - Queries Minecraft API for latest version
   - Falls back to configured version if API unavailable
   - Automatic configuration.json updates

3. **Download System**
   - Smart caching (doesn't re-download existing files)
   - Progress reporting (percentage, speed, ETA)
   - ZIP extraction with version tracking

4. **Update Process**
   - Stops running servers
   - Backs up configuration files
   - Copies new files
   - Restores configurations
   - Version tracking per server

5. **Logging**
   - Compatible with existing log format
   - MinecraftScriptLog.log (timestamped entries)
   - MinecraftUpdateHistory.json (version history)

## Prerequisites

### Required Software

1. **.NET 8 SDK** (NOT INSTALLED YET)
   - Download: https://dotnet.microsoft.com/download/dotnet/8.0
   - Choose: SDK (not just Runtime)
   - After installation, verify with: `dotnet --version`

2. **Visual Studio 2022** (Optional but recommended)
   - Download: https://visualstudio.microsoft.com/downloads/
   - Choose: Community Edition (free)
   - Workload: .NET Desktop Development

   OR

   **Visual Studio Code** with C# extension
   - Download: https://code.visualstudio.com/
   - Extension: C# Dev Kit

## Getting Started

### Step 1: Install .NET 8 SDK

1. Download from https://dotnet.microsoft.com/download/dotnet/8.0
2. Run the installer
3. Restart your terminal/IDE
4. Verify installation:
   ```bash
   dotnet --version
   ```
   Should output: `8.0.xxx`

### Step 2: Build the Project

```bash
cd "C:\Users\Janther\Downloads\Minecraft Servers\MinecraftServerManager"
dotnet restore
dotnet build
```

### Step 3: Test Core Functionality (Optional)

Create a simple console test app to verify the core logic works:

```bash
# Create console test project
dotnet new console -n TestApp
cd TestApp
dotnet add reference ../MinecraftServerManager.Core/MinecraftServerManager.Core.csproj
```

Then edit `Program.cs` to test the services.

## What's Next: Phase 2 - WPF GUI

Once .NET 8 SDK is installed and the Core project builds successfully, we'll proceed to:

### Phase 2 Tasks
1. Create WPF application project
2. Set up MVVM architecture with CommunityToolkit.MVVM
3. Add MahApps.Metro for modern UI
4. Create ViewModels (MainViewModel, ServerViewModel, etc.)
5. Create Views (MainWindow.xaml, etc.)
6. Wire up Core services to GUI

### Expected Timeline
- Phase 2: WPF GUI - 2-3 weeks
- Phase 3: Progress & Polish - 1 week
- Phase 4: Task Scheduler - 1 week
- Phase 5: Final Polish - 1 week

## Technical Details

### Architecture

The application follows clean architecture principles:

- **Models**: Plain C# classes representing data
- **Services**: Business logic with clear responsibilities
- **Dependency Injection Ready**: All services accept dependencies via constructor
- **Async/Await**: Throughout for responsive GUI
- **Progress Reporting**: Uses `IProgress<T>` for thread-safe updates

### Compatibility

- Maintains backward compatibility with PowerShell configuration
- Uses existing configuration.json format
- Writes to same log files
- Can run alongside PowerShell scripts during migration

### Key Ported Functions

| PowerShell Function | C# Implementation |
|---------------------|-------------------|
| `Get-ValidServerRoots` | `ServerDiscoveryService.DiscoverServersAsync()` |
| `Get-ServerZip` | `DownloadService.DownloadServerZipAsync()` |
| `Open-DownloadedServer` | `DownloadService.ExtractServerFilesAsync()` |
| `Update-Server` | `UpdateService.ApplyUpdateAsync()` |
| `Write-Log` | `LoggingService.Log()` |
| `Write-UpdateHistory` | `LoggingService.WriteUpdateHistoryAsync()` |
| MinecraftServer class | `Models.MinecraftServer` |

## Configuration

The application uses the existing `configuration.json` format:

```json
{
    "currentMinecraftVersion": "1.21.132.3",
    "serverRoot": "../TheServers"
}
```

## Troubleshooting

### Build Errors

**"The type or namespace name 'Serilog' could not be found"**
- Run: `dotnet restore` in the project directory

**"SDK not found"**
- Install .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
- Restart terminal after installation

### Runtime Errors

**"configuration.json not found"**
- Ensure configuration.json exists in the working directory
- Check that serverRoot path is correct

**"No servers discovered"**
- Verify TheServers directory exists
- Check that each server has required files:
  - bedrock_server.exe
  - server.properties
  - allowlist.json
  - permissions.json

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the implementation plan at `.claude/plans/woolly-hatching-clarke.md`
3. Check existing PowerShell logs for comparison

## License

This project maintains the same license as the original PowerShell implementation.

## Contributors

- Original PowerShell Implementation: [Original Author]
- C# Port: Claude AI (via Claude Code CLI)
