# Task: Install and configure bedrock-server-manager

## Goal
Replace the custom minecraft-server-manager (PowerShell scripts + Node.js dashboard) with the community project [bedrock-server-manager](https://github.com/DMedina559/bedrock-server-manager) by DMedina559.

## Current Setup
- **Platform**: Windows
- **Server location**: `c:\Users\Janther\Downloads\Minecraft Servers\TheServers\`
- **Existing servers** (5 Bedrock Dedicated Servers, standard directory structure):
  - `Earth` — creative, port 19138
  - `SledgeMountain` — survival, port 19136
  - `SledgerCreative` — creative, port 19132
  - `SledgerSurvival` — survival (details in server.properties)
  - `SurvivalIsland` — survival (details in server.properties)
- Each server has: `bedrock_server.exe`, `server.properties`, `permissions.json`, `allowlist.json`, `worlds/` folder
- Current Minecraft Bedrock version: **1.26.3.1**
- Some servers may be running when migration begins

## What the old system provided
- **PowerShell scripts**: auto-update servers from Microsoft's API, start/stop, version tracking
- **Node.js dashboard**: web UI with real-time status (RakNet UDP query), property editing with validation and undo/redo, update history, banner images per server

## What bedrock-server-manager should replace
- Server updates and version management
- Start/stop/restart from web UI
- Configuration editing
- Live monitoring and player tracking
- Backup management

## Installation Steps
1. Install Python if not already present
2. `pip install bedrock-server-manager`
3. Run `bedrock-server-manager setup` — interactive config wizard
4. Configure it to use the existing server directory at `c:\Users\Janther\Downloads\Minecraft Servers\TheServers\`
5. Launch the web UI with `bedrock-server-manager web`
6. Verify all 5 servers are detected and worlds are intact

## Critical Requirements
- **Do NOT delete or overwrite existing world data** — back up `TheServers\` before starting
- Preserve all server.properties, permissions.json, and allowlist.json files
- Verify each server can start and connect after migration
- If BSM cannot import existing servers, document what manual steps are needed

## Questions to Investigate During Setup
- Can BSM point to an existing server directory, or does it only create new ones?
- Does it use the same standard Bedrock server directory layout?
- How does it handle multiple servers on different ports?
- Does it support Windows natively or does it need WSL?
- What port does the web dashboard run on?

## After Migration
- Confirm all 5 servers appear in the BSM dashboard
- Test start/stop for at least one server
- Verify player connections still work on the expected ports
- The old `minecraft-server-manager/` directory can be archived once BSM is confirmed working

## References
- GitHub: https://github.com/DMedina559/bedrock-server-manager
- PyPI: https://pypi.org/project/bedrock-server-manager/
- Docs: https://bedrock-server-manager.readthedocs.io/
- CLI commands: https://dmedina559.github.io/bedrock-server-manager/cli/commands.html
