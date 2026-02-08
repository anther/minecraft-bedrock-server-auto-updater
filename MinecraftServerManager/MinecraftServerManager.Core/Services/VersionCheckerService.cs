using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Checks for latest Minecraft Bedrock server version
/// Ported from Get-ServerZip (lines 149-169) in server update.ps1
/// </summary>
public class VersionCheckerService
{
    private readonly HttpClient _httpClient;
    private readonly LoggingService _logger;
    private const string ApiUrl = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";
    private const string DownloadUrlTemplate = "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-{0}.zip";

    public VersionCheckerService(LoggingService logger)
    {
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };
        _logger = logger;
    }

    /// <summary>
    /// Gets the latest version from Minecraft API or falls back to config version
    /// </summary>
    public async Task<(string Version, string DownloadUrl)> GetLatestVersionAsync(string fallbackVersion)
    {
        try
        {
            _logger.Log($"Attempting to fetch version from API URL: {ApiUrl}");

            var response = await _httpClient.GetStringAsync(ApiUrl);
            var apiResponse = JsonSerializer.Deserialize<MinecraftApiResponse>(response);

            if (apiResponse?.Result?.Links != null)
            {
                var bedrockLink = apiResponse.Result.Links
                    .FirstOrDefault(l => l.DownloadType == "serverBedrockWindows");

                if (bedrockLink?.DownloadUrl != null)
                {
                    // Extract version from URL using regex: bedrock-server-([0-9\.]+)\.zip
                    var match = Regex.Match(bedrockLink.DownloadUrl, @"bedrock-server-([0-9\.]+)\.zip");
                    if (match.Success)
                    {
                        var latestVersion = match.Groups[1].Value;
                        _logger.Log($"Latest version from API: {latestVersion}");
                        return (latestVersion, bedrockLink.DownloadUrl);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"WARNING: Could not fetch latest version from API: {ex.Message}. Using configured version {fallbackVersion}");
        }

        // Fallback to configured version
        var downloadUrl = string.Format(DownloadUrlTemplate, fallbackVersion);
        return (fallbackVersion, downloadUrl);
    }

    /// <summary>
    /// Checks if a new version is available
    /// </summary>
    public async Task<bool> IsUpdateAvailableAsync(string currentVersion)
    {
        var (latestVersion, _) = await GetLatestVersionAsync(currentVersion);
        return latestVersion != currentVersion;
    }
}
