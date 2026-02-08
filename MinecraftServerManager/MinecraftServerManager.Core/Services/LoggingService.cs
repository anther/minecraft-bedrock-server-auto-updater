using Serilog;
using System.Text.Json;
using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Logging service - maintains MinecraftScriptLog.log and MinecraftUpdateHistory.json
/// Ported from Write-Log and Write-UpdateHistory functions in server update.ps1
/// </summary>
public class LoggingService
{
    private readonly string _logFilePath;
    private readonly string _updateHistoryPath;
    private readonly ILogger _logger;

    public LoggingService(string logDirectory)
    {
        if (!Directory.Exists(logDirectory))
        {
            Directory.CreateDirectory(logDirectory);
        }

        _logFilePath = Path.Combine(logDirectory, "MinecraftScriptLog.log");
        _updateHistoryPath = Path.Combine(logDirectory, "MinecraftUpdateHistory.json");

        // Configure Serilog to match PowerShell log format: [yyyy-MM-dd HH:mm:ss.fff] Message
        _logger = new LoggerConfiguration()
            .WriteTo.File(
                _logFilePath,
                outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff}] {Message:lj}{NewLine}{Exception}",
                rollingInterval: RollingInterval.Day,
                shared: true)
            .WriteTo.Console(outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff}] {Message:lj}{NewLine}")
            .CreateLogger();
    }

    /// <summary>
    /// Writes a log message
    /// Ported from Write-Log in server update.ps1:4-11
    /// </summary>
    public void Log(string message)
    {
        _logger.Information(message);
    }

    public void LogError(string message, Exception? ex = null)
    {
        if (ex != null)
        {
            _logger.Error(ex, message);
        }
        else
        {
            _logger.Error(message);
        }
    }

    public void LogWarning(string message)
    {
        _logger.Warning(message);
    }

    /// <summary>
    /// Writes or updates the update history
    /// Ported from Write-UpdateHistory in server update.ps1:68-125
    /// </summary>
    public async Task WriteUpdateHistoryAsync(string version)
    {
        var updateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        var historyEntries = new List<UpdateHistoryEntry>();

        // Load existing history if file exists
        if (File.Exists(_updateHistoryPath))
        {
            try
            {
                var json = await File.ReadAllTextAsync(_updateHistoryPath);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    historyEntries = JsonSerializer.Deserialize<List<UpdateHistoryEntry>>(json)
                        ?? new List<UpdateHistoryEntry>();
                }
            }
            catch (Exception ex)
            {
                LogError($"ERROR reading update history file: {ex.Message}", ex);
            }
        }

        // Check if version already exists
        var existingEntry = historyEntries.FirstOrDefault(e => e.Version == version);

        if (existingEntry != null)
        {
            // Update existing entry
            existingEntry.LastUpdatedAt = updateTime;
            existingEntry.TimesUpdated += 1;
        }
        else
        {
            // Add new entry
            historyEntries.Add(new UpdateHistoryEntry
            {
                Version = version,
                FirstUpdatedAt = updateTime,
                LastUpdatedAt = updateTime,
                TimesUpdated = 1
            });
        }

        // Write back to file
        var options = new JsonSerializerOptions { WriteIndented = true };
        var updatedJson = JsonSerializer.Serialize(historyEntries, options);
        await File.WriteAllTextAsync(_updateHistoryPath, updatedJson);

        Log($"Updated history with version {version}");
    }

    /// <summary>
    /// Reads the update history
    /// </summary>
    public async Task<List<UpdateHistoryEntry>> ReadUpdateHistoryAsync()
    {
        if (!File.Exists(_updateHistoryPath))
        {
            return new List<UpdateHistoryEntry>();
        }

        try
        {
            var json = await File.ReadAllTextAsync(_updateHistoryPath);
            return JsonSerializer.Deserialize<List<UpdateHistoryEntry>>(json)
                ?? new List<UpdateHistoryEntry>();
        }
        catch
        {
            return new List<UpdateHistoryEntry>();
        }
    }
}
