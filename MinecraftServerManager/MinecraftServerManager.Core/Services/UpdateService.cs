using System.Text.Json;
using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Handles applying updates to Minecraft servers
/// Ported from Update-Server function in server update.ps1:256-310
/// </summary>
public class UpdateService
{
    private readonly LoggingService _logger;
    private static readonly string[] ConfigFiles = { "server.properties", "allowlist.json", "permissions.json" };

    public UpdateService(LoggingService logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Checks if a server needs to be updated
    /// </summary>
    public async Task<bool> NeedsUpdateAsync(MinecraftServer server, string newVersion)
    {
        var versionFilePath = Path.Combine(server.RootPath, "currentVersion.json");

        if (!File.Exists(versionFilePath))
        {
            _logger.Log($"No currentVersion.json found for {server.Name}, performing server update");
            return true;
        }

        try
        {
            var json = await File.ReadAllTextAsync(versionFilePath);
            var currentVersion = JsonSerializer.Deserialize<VersionInfo>(json);

            if (currentVersion?.Version == newVersion)
            {
                _logger.Log($"No update needed for {server.Name}");
                return false;
            }
        }
        catch
        {
            _logger.LogWarning($"Failed to read version for {server.Name}, will update");
        }

        return true;
    }

    /// <summary>
    /// Applies update to a single server
    /// </summary>
    public async Task ApplyUpdateAsync(MinecraftServer server, string extractedPath)
    {
        if (!await NeedsUpdateAsync(server, await GetExtractedVersionAsync(extractedPath)))
        {
            return;
        }

        _logger.Log($"Updating server at: {server.RootPath}");

        // Stop the server
        await server.StopAsync();

        // Backup configuration files
        await BackupConfigFilesAsync(server);

        // Copy new files from extracted directory
        await CopyUpdateFilesAsync(extractedPath, server.RootPath);

        // Restore configuration files
        await RestoreConfigFilesAsync(server);

        _logger.Log($"Update applied to {server.Name}");
    }

    /// <summary>
    /// Backs up configuration files to BACKUP folder
    /// </summary>
    private async Task BackupConfigFilesAsync(MinecraftServer server)
    {
        var backupDir = Path.Combine(server.RootPath, "BACKUP");

        if (!Directory.Exists(backupDir))
        {
            Directory.CreateDirectory(backupDir);
        }

        foreach (var file in ConfigFiles)
        {
            var sourcePath = Path.Combine(server.RootPath, file);
            var backupPath = Path.Combine(backupDir, file);

            if (File.Exists(sourcePath))
            {
                File.Copy(sourcePath, backupPath, overwrite: true);
            }
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Copies all files from extracted directory to server root
    /// </summary>
    private async Task CopyUpdateFilesAsync(string extractedPath, string serverRoot)
    {
        await Task.Run(() =>
        {
            // Copy all files recursively
            CopyDirectory(extractedPath, serverRoot, overwrite: true);
        });
    }

    /// <summary>
    /// Restores configuration files from BACKUP folder
    /// </summary>
    private async Task RestoreConfigFilesAsync(MinecraftServer server)
    {
        var backupDir = Path.Combine(server.RootPath, "BACKUP");

        if (!Directory.Exists(backupDir))
        {
            return;
        }

        foreach (var file in ConfigFiles)
        {
            var backupPath = Path.Combine(backupDir, file);
            var targetPath = Path.Combine(server.RootPath, file);

            if (File.Exists(backupPath))
            {
                File.Copy(backupPath, targetPath, overwrite: true);
            }
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Gets the version from the extracted directory
    /// </summary>
    private async Task<string> GetExtractedVersionAsync(string extractedPath)
    {
        var versionFile = Path.Combine(extractedPath, "currentVersion.json");

        if (!File.Exists(versionFile))
        {
            return "Unknown";
        }

        try
        {
            var json = await File.ReadAllTextAsync(versionFile);
            var versionInfo = JsonSerializer.Deserialize<VersionInfo>(json);
            return versionInfo?.Version ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    /// <summary>
    /// Recursively copies a directory
    /// </summary>
    private void CopyDirectory(string sourceDir, string targetDir, bool overwrite)
    {
        var dir = new DirectoryInfo(sourceDir);

        if (!dir.Exists)
        {
            throw new DirectoryNotFoundException($"Source directory not found: {sourceDir}");
        }

        // Ensure target directory exists
        Directory.CreateDirectory(targetDir);

        // Copy files
        foreach (var file in dir.GetFiles())
        {
            var targetPath = Path.Combine(targetDir, file.Name);
            file.CopyTo(targetPath, overwrite);
        }

        // Copy subdirectories
        foreach (var subDir in dir.GetDirectories())
        {
            var targetPath = Path.Combine(targetDir, subDir.Name);
            CopyDirectory(subDir.FullName, targetPath, overwrite);
        }
    }
}
