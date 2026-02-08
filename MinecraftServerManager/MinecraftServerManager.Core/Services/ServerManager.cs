using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Main orchestrator for server management and updates
/// Ported from main script logic in server update.ps1:316-331
/// </summary>
public class ServerManager
{
    private readonly ConfigurationService _configService;
    private readonly ServerDiscoveryService _discoveryService;
    private readonly VersionCheckerService _versionChecker;
    private readonly DownloadService _downloadService;
    private readonly UpdateService _updateService;
    private readonly LoggingService _logger;

    public ServerManager(
        ConfigurationService configService,
        ServerDiscoveryService discoveryService,
        VersionCheckerService versionChecker,
        DownloadService downloadService,
        UpdateService updateService,
        LoggingService logger)
    {
        _configService = configService;
        _discoveryService = discoveryService;
        _versionChecker = versionChecker;
        _downloadService = downloadService;
        _updateService = updateService;
        _logger = logger;
    }

    /// <summary>
    /// Discovers all servers in the configured server root
    /// </summary>
    public async Task<List<MinecraftServer>> DiscoverServersAsync()
    {
        var config = await _configService.LoadConfigurationAsync();
        return await _discoveryService.DiscoverServersAsync(config.ServerRoot);
    }

    /// <summary>
    /// Checks if an update is available
    /// </summary>
    public async Task<(bool Available, string CurrentVersion, string LatestVersion)> CheckForUpdatesAsync()
    {
        var config = await _configService.LoadConfigurationAsync();
        var (latestVersion, _) = await _versionChecker.GetLatestVersionAsync(config.CurrentMinecraftVersion);

        var updateAvailable = latestVersion != config.CurrentMinecraftVersion;

        if (updateAvailable)
        {
            _logger.Log($"Newer version detected: {latestVersion} (was {config.CurrentMinecraftVersion})");
        }
        else
        {
            _logger.Log($"Current version {config.CurrentMinecraftVersion} is up to date");
        }

        return (updateAvailable, config.CurrentMinecraftVersion, latestVersion);
    }

    /// <summary>
    /// Runs the full update cycle
    /// Ported from main script execution in server update.ps1:316-331
    /// </summary>
    public async Task<UpdateResult> RunFullUpdateCycleAsync(
        IProgress<UpdateProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // 1. Load configuration
            progress?.Report(new UpdateProgress
            {
                Message = "Loading configuration...",
                Stage = UpdateStage.Initializing,
                Percentage = 0
            });

            var config = await _configService.LoadConfigurationAsync();

            // 2. Check for updates
            progress?.Report(new UpdateProgress
            {
                Message = "Checking for updates...",
                Stage = UpdateStage.CheckingVersion,
                Percentage = 10
            });

            var (latestVersion, downloadUrl) = await _versionChecker.GetLatestVersionAsync(config.CurrentMinecraftVersion);

            if (latestVersion == config.CurrentMinecraftVersion)
            {
                _logger.Log("No update available");
                progress?.Report(new UpdateProgress
                {
                    Message = "No update available",
                    Stage = UpdateStage.Complete,
                    Percentage = 100
                });
                return UpdateResult.NoUpdateAvailable;
            }

            // Update configuration with new version
            if (latestVersion != config.CurrentMinecraftVersion)
            {
                _logger.Log($"Newer version detected: {latestVersion} (was {config.CurrentMinecraftVersion}). Updating configuration.json...");
                await _configService.UpdateVersionAsync(latestVersion);
                config.CurrentMinecraftVersion = latestVersion;
            }

            // 3. Discover servers
            progress?.Report(new UpdateProgress
            {
                Message = "Discovering servers...",
                Stage = UpdateStage.Initializing,
                Percentage = 20
            });

            var servers = await _discoveryService.DiscoverServersAsync(config.ServerRoot);

            if (!servers.Any())
            {
                _logger.LogWarning("No valid servers found!");
                return UpdateResult.Failed;
            }

            // 4. Download update
            progress?.Report(new UpdateProgress
            {
                Message = "Downloading update...",
                Stage = UpdateStage.Downloading,
                Percentage = 30
            });

            var downloadProgress = new Progress<DownloadProgress>(p =>
            {
                progress?.Report(new UpdateProgress
                {
                    Message = p.StatusMessage,
                    Stage = UpdateStage.Downloading,
                    Percentage = 30 + (p.PercentComplete * 0.4) // 30-70%
                });
            });

            var extractPath = await _downloadService.DownloadAndExtractAsync(
                downloadUrl,
                latestVersion,
                downloadProgress,
                cancellationToken);

            // 5. Update each server
            progress?.Report(new UpdateProgress
            {
                Message = "Updating servers...",
                Stage = UpdateStage.UpdatingServers,
                Percentage = 70
            });

            var serverCount = servers.Count;
            for (int i = 0; i < serverCount; i++)
            {
                var server = servers[i];
                var serverProgress = 70 + ((i + 1) * 15 / serverCount);

                progress?.Report(new UpdateProgress
                {
                    Message = $"Updating {server.Name}...",
                    Stage = UpdateStage.UpdatingServers,
                    Percentage = serverProgress
                });

                await _updateService.ApplyUpdateAsync(server, extractPath);
            }

            // 6. Restart servers
            progress?.Report(new UpdateProgress
            {
                Message = "Restarting servers...",
                Stage = UpdateStage.RestartingServers,
                Percentage = 85
            });

            foreach (var server in servers)
            {
                await server.StartAsync();
                _logger.Log($"Started server: {server.Name}");
            }

            // 7. Log history
            progress?.Report(new UpdateProgress
            {
                Message = "Updating history...",
                Stage = UpdateStage.Complete,
                Percentage = 95
            });

            await _logger.WriteUpdateHistoryAsync(latestVersion);

            // Complete
            progress?.Report(new UpdateProgress
            {
                Message = "Update completed successfully!",
                Stage = UpdateStage.Complete,
                Percentage = 100
            });

            _logger.Log("Update cycle completed successfully");
            return UpdateResult.Success;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Update cycle failed: {ex.Message}", ex);

            progress?.Report(new UpdateProgress
            {
                Message = $"Update failed: {ex.Message}",
                Stage = UpdateStage.Error,
                Percentage = 0
            });

            return UpdateResult.Failed;
        }
    }
}
