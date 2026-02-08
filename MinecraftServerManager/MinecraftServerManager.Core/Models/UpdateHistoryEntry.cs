using System.Text.Json.Serialization;

namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents an entry in MinecraftUpdateHistory.json
/// </summary>
public class UpdateHistoryEntry
{
    [JsonPropertyName("Version")]
    public string Version { get; set; } = string.Empty;

    [JsonPropertyName("FirstUpdatedAt")]
    public string FirstUpdatedAt { get; set; } = string.Empty;

    [JsonPropertyName("LastUpdatedAt")]
    public string LastUpdatedAt { get; set; } = string.Empty;

    [JsonPropertyName("TimesUpdated")]
    public int TimesUpdated { get; set; }
}
