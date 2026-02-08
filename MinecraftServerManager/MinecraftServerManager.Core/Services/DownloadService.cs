using System.Diagnostics;
using System.IO.Compression;
using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Handles downloading and extracting Minecraft server files
/// Ported from Get-ServerZip and Open-DownloadedServer in server update.ps1
/// </summary>
public class DownloadService
{
    private readonly LoggingService _logger;
    private readonly HttpClient _httpClient;
    private readonly string _tempDirectory;

    public DownloadService(LoggingService logger)
    {
        _logger = logger;
        _httpClient = new HttpClient();
        _tempDirectory = Path.Combine(Path.GetTempPath(), "MinecraftBedrockUpdate");

        if (!Directory.Exists(_tempDirectory))
        {
            Directory.CreateDirectory(_tempDirectory);
        }
    }

    /// <summary>
    /// Downloads the server ZIP file with progress reporting
    /// Ported from Get-ServerZip (lines 180-192) in server update.ps1
    /// </summary>
    public async Task<string> DownloadServerZipAsync(
        string downloadUrl,
        string version,
        IProgress<DownloadProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        var filename = $"bedrock-server-{version}.zip";
        var zipPath = Path.Combine(_tempDirectory, filename);

        // Check if already downloaded (smart caching)
        if (File.Exists(zipPath))
        {
            _logger.Log($"Zip already downloaded: {filename}");
            return zipPath;
        }

        _logger.Log($"Downloading: {filename} to: {zipPath}");

        using var response = await _httpClient.GetAsync(downloadUrl,
            HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength ?? -1;
        var buffer = new byte[8192];
        var bytesRead = 0L;
        var stopwatch = Stopwatch.StartNew();

        using var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var fileStream = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

        int read;
        while ((read = await contentStream.ReadAsync(buffer, cancellationToken)) > 0)
        {
            await fileStream.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            bytesRead += read;

            // Calculate progress metrics
            var elapsedSeconds = stopwatch.Elapsed.TotalSeconds;
            if (elapsedSeconds > 0)
            {
                var speedMbps = (bytesRead / 1024.0 / 1024.0) / elapsedSeconds;
                var eta = totalBytes > 0
                    ? TimeSpan.FromSeconds((totalBytes - bytesRead) / (bytesRead / elapsedSeconds))
                    : TimeSpan.Zero;

                progress?.Report(new DownloadProgress
                {
                    BytesReceived = bytesRead,
                    TotalBytes = totalBytes,
                    PercentComplete = totalBytes > 0 ? (double)bytesRead / totalBytes * 100 : 0,
                    DownloadSpeedMbps = speedMbps,
                    EstimatedTimeRemaining = eta,
                    StatusMessage = $"Downloading: {bytesRead / 1024 / 1024} MB / {totalBytes / 1024 / 1024} MB"
                });
            }
        }

        _logger.Log($"Download completed: {zipPath}");
        return zipPath;
    }

    /// <summary>
    /// Extracts the downloaded ZIP file and prepares it for deployment
    /// Ported from Open-DownloadedServer (lines 195-253) in server update.ps1
    /// </summary>
    public async Task<string> ExtractServerFilesAsync(string zipPath, string version)
    {
        var extractDir = Path.Combine(_tempDirectory, "extracted");
        var versionFilePath = Path.Combine(extractDir, "currentVersion.json");

        // Check if already extracted with same version
        if (File.Exists(versionFilePath))
        {
            try
            {
                var json = await File.ReadAllTextAsync(versionFilePath);
                var existingVersion = System.Text.Json.JsonSerializer.Deserialize<VersionInfo>(json);

                if (existingVersion?.Version == version)
                {
                    _logger.Log($"Extracted folder already contains version {version}. Skipping extraction.");
                    return extractDir;
                }
                else
                {
                    _logger.Log($"Extracted version ({existingVersion?.Version}) differs. Re-extracting...");
                }
            }
            catch
            {
                _logger.Log("Failed to read version info. Re-extracting.");
            }
        }

        // Clean up old extraction
        if (Directory.Exists(extractDir))
        {
            _logger.Log("Cleaning up old extraction...");
            Directory.Delete(extractDir, true);
        }

        // Extract
        _logger.Log($"Extracting Zip to: {extractDir}");
        Directory.CreateDirectory(extractDir);
        ZipFile.ExtractToDirectory(zipPath, extractDir);
        _logger.Log($"Extracted to: {extractDir}");

        // Delete config files from extraction (they will be restored from each server)
        foreach (var file in new[] { "server.properties", "allowlist.json", "permissions.json" })
        {
            var filePath = Path.Combine(extractDir, file);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }

        // Write version file
        var versionInfo = new VersionInfo(version);
        var versionJson = System.Text.Json.JsonSerializer.Serialize(versionInfo);
        await File.WriteAllTextAsync(versionFilePath, versionJson);

        return extractDir;
    }

    /// <summary>
    /// Downloads and extracts in one operation
    /// </summary>
    public async Task<string> DownloadAndExtractAsync(
        string downloadUrl,
        string version,
        IProgress<DownloadProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        var zipPath = await DownloadServerZipAsync(downloadUrl, version, progress, cancellationToken);

        progress?.Report(new DownloadProgress
        {
            PercentComplete = 100,
            StatusMessage = "Extracting files..."
        });

        var extractPath = await ExtractServerFilesAsync(zipPath, version);

        progress?.Report(new DownloadProgress
        {
            PercentComplete = 100,
            StatusMessage = "Extraction complete"
        });

        return extractPath;
    }
}
