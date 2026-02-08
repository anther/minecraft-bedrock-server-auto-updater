namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents the result of a Minecraft server query
/// </summary>
public class PlayerQueryResult
{
    /// <summary>
    /// Current number of players online
    /// </summary>
    public int PlayerCount { get; set; }

    /// <summary>
    /// List of player names currently online
    /// </summary>
    public List<string> PlayerNames { get; set; } = new();

    /// <summary>
    /// Maximum number of players allowed
    /// </summary>
    public int MaxPlayers { get; set; }

    /// <summary>
    /// Server MOTD (message of the day)
    /// </summary>
    public string? Motd { get; set; }

    /// <summary>
    /// Game type (e.g., "SMP", "Survival")
    /// </summary>
    public string? GameType { get; set; }

    /// <summary>
    /// Map/world name
    /// </summary>
    public string? Map { get; set; }

    /// <summary>
    /// Timestamp when the query was performed
    /// </summary>
    public DateTime QueryTime { get; set; } = DateTime.Now;

    /// <summary>
    /// Error message if query failed
    /// </summary>
    public string? Error { get; set; }

    /// <summary>
    /// Whether the query was successful
    /// </summary>
    public bool IsSuccess => Error == null;
}
