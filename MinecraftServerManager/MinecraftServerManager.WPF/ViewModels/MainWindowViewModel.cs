using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.DependencyInjection;
using MinecraftServerManager.Core.Services;
using MinecraftServerManager.WPF.Services;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// Main ViewModel that orchestrates navigation and application-level operations
/// </summary>
public partial class MainWindowViewModel : ViewModelBase
{
    private readonly ServerManager _serverManager;
    private readonly LoggingService _logger;
    private readonly IDialogService _dialogService;
    private readonly IServiceProvider _serviceProvider;

    private ViewModelBase? _currentView;
    private string _currentVersion = "Unknown";
    private string _latestVersion = "Unknown";
    private bool _updateAvailable;
    private bool _isUpdateInProgress;

    public MainWindowViewModel(
        ServerManager serverManager,
        LoggingService logger,
        IDialogService dialogService,
        IServiceProvider serviceProvider)
    {
        _serverManager = serverManager;
        _logger = logger;
        _dialogService = dialogService;
        _serviceProvider = serviceProvider;

        // Initialize by navigating to server list
        _ = InitializeAsync();
    }

    /// <summary>
    /// Currently displayed view
    /// </summary>
    public ViewModelBase? CurrentView
    {
        get => _currentView;
        set => SetProperty(ref _currentView, value);
    }

    /// <summary>
    /// Current Minecraft version from configuration
    /// </summary>
    public string CurrentVersion
    {
        get => _currentVersion;
        set => SetProperty(ref _currentVersion, value);
    }

    /// <summary>
    /// Latest available Minecraft version
    /// </summary>
    public string LatestVersion
    {
        get => _latestVersion;
        set => SetProperty(ref _latestVersion, value);
    }

    /// <summary>
    /// Whether an update is available
    /// </summary>
    public bool UpdateAvailable
    {
        get => _updateAvailable;
        set => SetProperty(ref _updateAvailable, value);
    }

    /// <summary>
    /// Whether an update is currently in progress
    /// </summary>
    public bool IsUpdateInProgress
    {
        get => _isUpdateInProgress;
        set => SetProperty(ref _isUpdateInProgress, value);
    }

    private async Task InitializeAsync()
    {
        // Check for updates on startup
        await CheckForUpdatesAsync();

        // Navigate to server list
        NavigateToServers();
    }

    /// <summary>
    /// Checks for Minecraft server updates
    /// </summary>
    [RelayCommand]
    private async Task CheckForUpdatesAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Checking for updates...";

            var (available, current, latest) = await _serverManager.CheckForUpdatesAsync();

            CurrentVersion = current;
            LatestVersion = latest;
            UpdateAvailable = available;

            StatusMessage = available
                ? $"Update available: {latest} (current: {current})"
                : $"Up to date: {current}";

            _logger.Log(StatusMessage);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error checking for updates: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
            await _dialogService.ShowErrorAsync("Update Check Failed", ex.Message);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Runs the full update cycle
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanRunUpdate))]
    private async Task RunUpdateAsync()
    {
        try
        {
            var confirm = await _dialogService.ShowConfirmAsync(
                "Run Update",
                $"This will update all servers from {CurrentVersion} to {LatestVersion}. Continue?");

            if (!confirm)
                return;

            IsUpdateInProgress = true;

            // Navigate to update progress view
            var updateProgressVM = _serviceProvider.GetRequiredService<UpdateProgressViewModel>();
            CurrentView = updateProgressVM;

            // Start the update
            await updateProgressVM.StartUpdateAsync();

            // Refresh version info after update
            await CheckForUpdatesAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error during update: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
            await _dialogService.ShowErrorAsync("Update Failed", ex.Message);
        }
        finally
        {
            IsUpdateInProgress = false;
        }
    }

    private bool CanRunUpdate() => UpdateAvailable && !IsUpdateInProgress;

    /// <summary>
    /// Navigates to the server list view
    /// </summary>
    [RelayCommand]
    private void NavigateToServers()
    {
        var serverListVM = _serviceProvider.GetRequiredService<ServerListViewModel>();
        CurrentView = serverListVM;
        StatusMessage = "Viewing server list";
    }

    /// <summary>
    /// Navigates to the update history view
    /// </summary>
    [RelayCommand]
    private void NavigateToHistory()
    {
        var historyVM = _serviceProvider.GetRequiredService<UpdateHistoryViewModel>();
        CurrentView = historyVM;
        StatusMessage = "Viewing update history";
    }

    /// <summary>
    /// Navigates to the settings view
    /// </summary>
    [RelayCommand]
    private void NavigateToSettings()
    {
        var settingsVM = _serviceProvider.GetRequiredService<SettingsViewModel>();
        CurrentView = settingsVM;
        StatusMessage = "Viewing settings";
    }

    /// <summary>
    /// Navigates to server details view for a specific server
    /// </summary>
    public void NavigateToServerDetails(ServerItemViewModel serverItem)
    {
        var detailsVM = new ServerDetailsViewModel(serverItem);
        CurrentView = detailsVM;
        StatusMessage = $"Viewing details for {serverItem.Name}";
    }
}
