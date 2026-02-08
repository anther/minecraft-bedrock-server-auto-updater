using CommunityToolkit.Mvvm.Input;
using MinecraftServerManager.Core.Services;
using System.Collections.ObjectModel;
using System.Windows.Threading;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel for managing the list of discovered servers
/// </summary>
public partial class ServerListViewModel : ViewModelBase
{
    private readonly ServerManager _serverManager;
    private readonly LoggingService _logger;
    private readonly DispatcherTimer _statusPollingTimer;

    private ObservableCollection<ServerItemViewModel> _servers = new();
    private ServerItemViewModel? _selectedServer;
    private bool _isLoading;

    public ServerListViewModel(ServerManager serverManager, LoggingService logger)
    {
        _serverManager = serverManager;
        _logger = logger;

        // Setup status polling timer (5 seconds)
        _statusPollingTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(5)
        };
        _statusPollingTimer.Tick += async (s, e) => await PollServerStatusAsync();
        _statusPollingTimer.Start();

        // Load servers on initialization
        _ = RefreshServersAsync();
    }

    /// <summary>
    /// Collection of discovered servers
    /// </summary>
    public ObservableCollection<ServerItemViewModel> Servers
    {
        get => _servers;
        set => SetProperty(ref _servers, value);
    }

    /// <summary>
    /// Currently selected server in the list
    /// </summary>
    public ServerItemViewModel? SelectedServer
    {
        get => _selectedServer;
        set => SetProperty(ref _selectedServer, value);
    }

    /// <summary>
    /// Whether the server discovery is in progress
    /// </summary>
    public bool IsLoading
    {
        get => _isLoading;
        set => SetProperty(ref _isLoading, value);
    }

    /// <summary>
    /// Number of discovered servers
    /// </summary>
    public int ServerCount => Servers.Count;

    /// <summary>
    /// Discovers and loads servers from the configured root path
    /// </summary>
    [RelayCommand]
    private async Task RefreshServersAsync()
    {
        try
        {
            IsLoading = true;
            IsBusy = true;
            StatusMessage = "Discovering servers...";

            var servers = await _serverManager.DiscoverServersAsync();

            Servers.Clear();
            foreach (var server in servers)
            {
                Servers.Add(new ServerItemViewModel(server));
            }

            StatusMessage = $"Found {Servers.Count} server(s)";
            _logger.Log(StatusMessage);
            OnPropertyChanged(nameof(ServerCount));
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error discovering servers: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
        }
        finally
        {
            IsLoading = false;
            IsBusy = false;
        }
    }

    /// <summary>
    /// Starts all servers
    /// </summary>
    [RelayCommand]
    private async Task StartAllServersAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Starting all servers...";

            foreach (var serverVM in Servers)
            {
                if (!serverVM.IsRunning)
                {
                    await serverVM.StartServerCommand.ExecuteAsync(null);
                }
            }

            StatusMessage = "All servers started";
            _logger.Log("Started all servers");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error starting servers: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Stops all servers
    /// </summary>
    [RelayCommand]
    private async Task StopAllServersAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Stopping all servers...";

            foreach (var serverVM in Servers)
            {
                if (serverVM.IsRunning)
                {
                    await serverVM.StopServerCommand.ExecuteAsync(null);
                }
            }

            StatusMessage = "All servers stopped";
            _logger.Log("Stopped all servers");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error stopping servers: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Polls server status every 5 seconds
    /// </summary>
    private async Task PollServerStatusAsync()
    {
        if (IsLoading || IsBusy)
            return;

        try
        {
            foreach (var serverVM in Servers)
            {
                await serverVM.RefreshStatusAsync();
            }
        }
        catch
        {
            // Silently fail for polling errors
        }
    }
}
