using System.Text.Json;
using MinecraftServerManager.Core.Models;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Handles loading and saving configuration.json
/// </summary>
public class ConfigurationService
{
    private readonly string _configPath;
    private readonly LoggingService _logger;

    public ConfigurationService(string configPath, LoggingService logger)
    {
        _configPath = configPath;
        _logger = logger;
    }

    /// <summary>
    /// Loads the configuration from configuration.json
    /// </summary>
    public async Task<ServerConfiguration> LoadConfigurationAsync()
    {
        if (!File.Exists(_configPath))
        {
            _logger.LogError($"ERROR: configuration.json not found at {_configPath}");
            throw new FileNotFoundException("configuration.json not found", _configPath);
        }

        try
        {
            var json = await File.ReadAllTextAsync(_configPath);
            var config = JsonSerializer.Deserialize<ServerConfiguration>(json);

            if (config == null)
            {
                throw new InvalidOperationException("Failed to deserialize configuration.json");
            }

            if (string.IsNullOrWhiteSpace(config.CurrentMinecraftVersion))
            {
                throw new InvalidOperationException("Missing 'currentMinecraftVersion' in config");
            }

            // Resolve relative server root path
            if (!Path.IsPathRooted(config.ServerRoot))
            {
                var configDir = Path.GetDirectoryName(_configPath) ?? ".";
                config.ServerRoot = Path.GetFullPath(Path.Combine(configDir, config.ServerRoot));
            }

            _logger.Log($"Configuration loaded: Version={config.CurrentMinecraftVersion}, ServerRoot={config.ServerRoot}");
            return config;
        }
        catch (Exception ex)
        {
            _logger.LogError($"ERROR: Failed to read or parse configuration.json: {ex.Message}", ex);
            throw;
        }
    }

    /// <summary>
    /// Saves the configuration to configuration.json
    /// </summary>
    public async Task SaveConfigurationAsync(ServerConfiguration config)
    {
        try
        {
            var options = new JsonSerializerOptions { WriteIndented = true };
            var json = JsonSerializer.Serialize(config, options);
            await File.WriteAllTextAsync(_configPath, json);

            _logger.Log($"Configuration updated: Version={config.CurrentMinecraftVersion}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"ERROR: Failed to save configuration.json: {ex.Message}", ex);
            throw;
        }
    }

    /// <summary>
    /// Updates just the version in configuration.json
    /// </summary>
    public async Task UpdateVersionAsync(string newVersion)
    {
        var config = await LoadConfigurationAsync();
        config.CurrentMinecraftVersion = newVersion;
        await SaveConfigurationAsync(config);
    }
}
