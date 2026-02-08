namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents server.properties file configuration
/// </summary>
public class ServerProperties
{
    private readonly Dictionary<string, string> _properties = new();

    public string? ServerName => GetProperty("server-name");
    public string? Gamemode => GetProperty("gamemode");
    public int ServerPort => int.TryParse(GetProperty("server-port"), out var port) ? port : 19132;
    public int ServerPortV6 => int.TryParse(GetProperty("server-portv6"), out var port) ? port : 19133;
    public string? LevelName => GetProperty("level-name");
    public string? LevelType => GetProperty("level-type");
    public int MaxPlayers => int.TryParse(GetProperty("max-players"), out var max) ? max : 10;
    public string? Difficulty => GetProperty("difficulty");
    public bool AllowCheats => GetProperty("allow-cheats")?.ToLower() == "true";

    public string? GetProperty(string key)
    {
        return _properties.TryGetValue(key, out var value) ? value : null;
    }

    public void SetProperty(string key, string value)
    {
        _properties[key] = value;
    }

    public IReadOnlyDictionary<string, string> GetAllProperties() => _properties;

    /// <summary>
    /// Parses server.properties file content
    /// </summary>
    public static async Task<ServerProperties> ParseAsync(string filePath)
    {
        var props = new ServerProperties();

        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"server.properties not found at {filePath}");
        }

        var lines = await File.ReadAllLinesAsync(filePath);

        foreach (var line in lines)
        {
            // Skip comments and empty lines
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#'))
            {
                continue;
            }

            // Split key=value
            var parts = line.Split('=', 2);
            if (parts.Length == 2)
            {
                var key = parts[0].Trim();
                var value = parts[1].Trim();
                props.SetProperty(key, value);
            }
        }

        return props;
    }
}
