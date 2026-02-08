namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents download progress for reporting to UI
/// </summary>
public class DownloadProgress
{
    public long BytesReceived { get; set; }
    public long TotalBytes { get; set; }
    public double PercentComplete { get; set; }
    public double DownloadSpeedMbps { get; set; }
    public TimeSpan EstimatedTimeRemaining { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
}

/// <summary>
/// Represents overall update progress
/// </summary>
public class UpdateProgress
{
    public string Message { get; set; } = string.Empty;
    public double Percentage { get; set; }
    public UpdateStage Stage { get; set; }
}

public enum UpdateStage
{
    Initializing,
    CheckingVersion,
    Downloading,
    Extracting,
    UpdatingServers,
    RestartingServers,
    Complete,
    Error
}

public enum UpdateResult
{
    Success,
    NoUpdateAvailable,
    Failed
}
