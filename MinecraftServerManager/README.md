# Minecraft Server Manager - C# Implementation

A C# WPF GUI application for managing Minecraft Bedrock servers with automatic updates. This project is a complete rewrite of the PowerShell-based auto-updater.

## Current Status: Phase 2 Complete (WPF GUI)

### What's Been Built

**Phase 1: Core Business Logic** ✅ COMPLETE
- All PowerShell functionality ported to C#
- Clean, testable service-based architecture
- Full logging and history tracking
- Ready for GUI integration

**Phase 2: WPF GUI** ✅ COMPLETE
- Full MVVM architecture with CommunityToolkit.Mvvm
- Modern UI with ModernWpfUI styling
- Complete dependency injection setup
- All views and ViewModels implemented
- **Status:** Built successfully - Ready for testing

📋 **[See detailed testing instructions in WPF_IMPLEMENTATION_PROGRESS.md](WPF_IMPLEMENTATION_PROGRESS.md)**

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
├── MinecraftServerManager.WPF/           # WPF GUI application
│   ├── Views/                             # XAML views
│   │   ├── MainWindow.xaml               # Main shell
│   │   ├── ServerListView.xaml           # Server management
│   │   ├── UpdateProgressView.xaml       # Update tracking
│   │   ├── UpdateHistoryView.xaml        # History display
│   │   ├── SettingsView.xaml             # Configuration
│   │   └── ServerDetailsView.xaml        # Server details
│   │
│   ├── ViewModels/                        # MVVM ViewModels
│   │   ├── MainWindowViewModel.cs        # Main orchestrator
│   │   ├── ServerListViewModel.cs        # Server list
│   │   ├── ServerItemViewModel.cs        # Individual server
│   │   ├── UpdateProgressViewModel.cs    # Progress tracking
│   │   ├── UpdateHistoryViewModel.cs     # History
│   │   └── SettingsViewModel.cs          # Settings
│   │
│   ├── Services/                          # WPF-specific services
│   │   ├── IDialogService.cs             # Dialog abstraction
│   │   └── DialogService.cs              # MessageBox wrapper
│   │
│   └── Converters/                        # Value converters
│       ├── BooleanToVisibilityConverter.cs
│       ├── InverseBooleanConverter.cs
│       └── ServerStatusToColorConverter.cs
│
├── WPF_IMPLEMENTATION_PROGRESS.md        # Testing guide
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

### Quick Start (Run the GUI)

```bash
cd "C:\Users\Janther\Downloads\Minecraft Servers\MinecraftServerManager"
dotnet run --project "MinecraftServerManager.WPF/MinecraftServerManager.WPF.csproj"
```

**First time users:** See [WPF_IMPLEMENTATION_PROGRESS.md](WPF_IMPLEMENTATION_PROGRESS.md) for complete testing guide.

### Prerequisites

1. **.NET 8 SDK**
   - Download: https://dotnet.microsoft.com/download/dotnet/8.0
   - Choose: SDK (not just Runtime)
   - Verify: `dotnet --version` should output `8.0.xxx`

2. **Valid configuration.json** in the working directory:
   ```json
   {
     "ServerRoot": "C:\\Path\\To\\Servers",
     "CurrentMinecraftVersion": "1.20.50.03"
   }
   ```

3. **At least one Minecraft Bedrock server** in ServerRoot with:
   - `bedrock_server.exe`
   - `server.properties`
   - `allowlist.json`
   - `permissions.json`

### Build the Project

```bash
cd "C:\Users\Janther\Downloads\Minecraft Servers\MinecraftServerManager"
dotnet restore
dotnet build
```

Should complete with 0 errors (warnings are OK).

## GUI Features

The WPF GUI provides:

### 🎯 Main Features
- **Server Discovery & Management** - View all servers with real-time status (auto-updates every 5 seconds)
- **One-Click Updates** - Check for updates and apply them with real-time progress tracking
- **Individual Server Control** - Start/stop servers, view details, open folders
- **Update History** - See all past updates with timestamps
- **Settings Management** - Configure server root and view logs

### 🖥️ User Interface
- **Modern Design** - ModernWpfUI styling for clean, modern appearance
- **Navigation Sidebar** - Easy access to Servers, History, and Settings
- **Real-time Status** - Color-coded indicators (🟢 running, 🔴 stopped)
- **Progress Tracking** - Detailed logs and progress bar during updates
- **Responsive UI** - Never freezes, all operations are async

### 🧪 Testing Status
**See [WPF_IMPLEMENTATION_PROGRESS.md](WPF_IMPLEMENTATION_PROGRESS.md) for:**
- Complete testing checklist (11 tests)
- Step-by-step testing instructions
- Known issues and troubleshooting
- Success criteria

## What's Next: Testing & Polish

### Immediate Next Steps
1. ✅ Build successful - **COMPLETE**
2. ⏳ Run application and execute testing checklist - **IN PROGRESS**
3. ⏳ Fix any issues found during testing
4. ⏳ Address known warnings (System.Text.Json vulnerability, nullable references)
5. ⏳ Production deployment

### Future Phases
- Phase 3: Task Scheduler Integration - Automated updates
- Phase 4: Advanced Features - Backup management, server groups
- Phase 5: Final Polish - Documentation, installer

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
