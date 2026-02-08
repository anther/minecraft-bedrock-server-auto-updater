namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel for displaying detailed server information
/// </summary>
public class ServerDetailsViewModel : ViewModelBase
{
    private readonly ServerItemViewModel _serverItem;

    public ServerDetailsViewModel(ServerItemViewModel serverItem)
    {
        _serverItem = serverItem;
    }

    /// <summary>
    /// The server item being displayed
    /// </summary>
    public ServerItemViewModel ServerItem => _serverItem;

    /// <summary>
    /// Server name
    /// </summary>
    public string Name => _serverItem.Name;

    /// <summary>
    /// Server version
    /// </summary>
    public string Version => _serverItem.Version;

    /// <summary>
    /// Whether the server is running
    /// </summary>
    public bool IsRunning => _serverItem.IsRunning;

    /// <summary>
    /// Server root path
    /// </summary>
    public string RootPath => _serverItem.RootPath;

    /// <summary>
    /// Server name from properties
    /// </summary>
    public string ServerName => _serverItem.ServerName;

    /// <summary>
    /// Server port
    /// </summary>
    public int Port => _serverItem.Port;

    /// <summary>
    /// Server IPv6 port
    /// </summary>
    public int PortV6 => _serverItem.PortV6;

    /// <summary>
    /// Game mode
    /// </summary>
    public string Gamemode => _serverItem.Gamemode;

    /// <summary>
    /// Difficulty
    /// </summary>
    public string Difficulty => _serverItem.Difficulty;

    /// <summary>
    /// Maximum players
    /// </summary>
    public int MaxPlayers => _serverItem.MaxPlayers;
}
