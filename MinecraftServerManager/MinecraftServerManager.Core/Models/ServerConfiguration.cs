using System.Text.Json.Serialization;

namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents configuration.json file
/// </summary>
public class ServerConfiguration
{
    [JsonPropertyName("currentMinecraftVersion")]
    public string CurrentMinecraftVersion { get; set; } = "Unknown";

    [JsonPropertyName("serverRoot")]
    public string ServerRoot { get; set; } = "../TheServers";
}
