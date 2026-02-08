using CommunityToolkit.Mvvm.Input;
using MinecraftServerManager.Core.Models;
using System.Diagnostics;
using System.Windows.Media;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel wrapping a MinecraftServer instance for UI binding
/// </summary>
public partial class ServerItemViewModel : ViewModelBase
{
    private readonly MinecraftServer _server;

    public ServerItemViewModel(MinecraftServer server)
    {
        _server = server;
    }

    /// <summary>
    /// The underlying MinecraftServer model
    /// </summary>
    public MinecraftServer Server => _server;

    /// <summary>
    /// Server name (folder name)
    /// </summary>
    public string Name => _server.Name;

    /// <summary>
    /// Server version
    /// </summary>
    public string Version => _server.Version;

    /// <summary>
    /// Whether the server process is currently running
    /// </summary>
    public bool IsRunning => _server.IsRunning;

    /// <summary>
    /// Server name from server.properties
    /// </summary>
    public string ServerName => _server.Properties.ServerName;

    /// <summary>
    /// Server port from server.properties
    /// </summary>
    public int Port => _server.Properties.ServerPort;

    /// <summary>
    /// Server IPv6 port
    /// </summary>
    public int PortV6 => _server.Properties.ServerPortV6;

    /// <summary>
    /// Game mode (Survival, Creative, Adventure)
    /// </summary>
    public string Gamemode => _server.Properties.Gamemode;

    /// <summary>
    /// Difficulty level
    /// </summary>
    public string Difficulty => _server.Properties.Difficulty;

    /// <summary>
    /// Maximum number of players
    /// </summary>
    public int MaxPlayers => _server.Properties.MaxPlayers;

    /// <summary>
    /// Root path of the server
    /// </summary>
    public string RootPath => _server.RootPath;

    /// <summary>
    /// Status color indicator (Green for running, Red for stopped)
    /// </summary>
    public Brush StatusColor => IsRunning ? Brushes.LimeGreen : Brushes.Crimson;

    /// <summary>
    /// Refreshes the server status by querying the process
    /// </summary>
    public async Task RefreshStatusAsync()
    {
        await _server.UpdateRunningStatusAsync();
        OnPropertyChanged(nameof(IsRunning));
        OnPropertyChanged(nameof(StatusColor));
    }

    /// <summary>
    /// Starts the server
    /// </summary>
    [RelayCommand]
    private async Task StartServerAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = $"Starting {Name}...";

            await _server.StartAsync();
            await RefreshStatusAsync();

            StatusMessage = $"{Name} started successfully";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error starting {Name}: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Stops the server
    /// </summary>
    [RelayCommand]
    private async Task StopServerAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = $"Stopping {Name}...";

            await _server.StopAsync();
            await RefreshStatusAsync();

            StatusMessage = $"{Name} stopped successfully";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error stopping {Name}: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Opens the server folder in File Explorer
    /// </summary>
    [RelayCommand]
    private void OpenFolder()
    {
        try
        {
            Process.Start("explorer.exe", _server.RootPath);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error opening folder: {ex.Message}";
        }
    }
}
