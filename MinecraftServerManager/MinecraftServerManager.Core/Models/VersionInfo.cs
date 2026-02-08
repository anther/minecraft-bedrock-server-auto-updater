using System.Text.Json.Serialization;

namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents version information stored in currentVersion.json
/// </summary>
public class VersionInfo
{
    [JsonPropertyName("Version")]
    public string Version { get; set; } = "Unknown";

    public VersionInfo() { }

    public VersionInfo(string version)
    {
        Version = version;
    }
}

/// <summary>
/// Represents the Minecraft API response for version checking
/// </summary>
public class MinecraftApiResponse
{
    [JsonPropertyName("result")]
    public ApiResult? Result { get; set; }
}

public class ApiResult
{
    [JsonPropertyName("links")]
    public List<DownloadLink>? Links { get; set; }
}

public class DownloadLink
{
    [JsonPropertyName("downloadType")]
    public string? DownloadType { get; set; }

    [JsonPropertyName("downloadUrl")]
    public string? DownloadUrl { get; set; }
}
