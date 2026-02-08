using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Discovers and validates Minecraft servers in a directory
/// Ported from Get-ValidServerRoots in server update.ps1:14-64
/// </summary>
public class ServerDiscoveryService
{
    private readonly LoggingService _logger;
    private static readonly string[] RequiredFiles =
    {
        "bedrock_server.exe",
        "permissions.json",
        "allowlist.json",
        "server.properties"
    };

    public ServerDiscoveryService(LoggingService logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Discovers all valid Minecraft servers in the specified root directory
    /// </summary>
    public async Task<List<MinecraftServer>> DiscoverServersAsync(string serverRootPath)
    {
        var validServers = new List<MinecraftServer>();

        if (!Directory.Exists(serverRootPath))
        {
            _logger.LogError($"Server root path does not exist: {serverRootPath}");
            return validServers;
        }

        _logger.Log($"Using serverRoot path: {serverRootPath}");
        _logger.Log($"Searching for Server Roots by searching for existence of files: {string.Join(", ", RequiredFiles)}");

        var serverDirectories = Directory.GetDirectories(serverRootPath);

        foreach (var serverDir in serverDirectories)
        {
            if (await ValidateServerDirectoryAsync(serverDir))
            {
                try
                {
                    var server = await MinecraftServer.CreateAsync(serverDir);
                    validServers.Add(server);
                    _logger.Log($"Found Server Root: {server.GetFullDescription()}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Failed to create server instance for {serverDir}: {ex.Message}");
                }
            }
        }

        return validServers;
    }

    /// <summary>
    /// Validates that a directory contains all required server files
    /// </summary>
    private async Task<bool> ValidateServerDirectoryAsync(string directory)
    {
        await Task.CompletedTask; // Make async for consistency

        foreach (var file in RequiredFiles)
        {
            var filePath = Path.Combine(directory, file);
            if (!File.Exists(filePath))
            {
                _logger.Log($"Not Server Root: Missing {file} in {directory}");
                return false;
            }
        }

        return true;
    }
}
