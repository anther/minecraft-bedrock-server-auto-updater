using System.IO;
using CommunityToolkit.Mvvm.Input;
using MinecraftServerManager.Core.Models;
using MinecraftServerManager.Core.Services;
using MinecraftServerManager.WPF.Services;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel for managing application settings
/// </summary>
public partial class SettingsViewModel : ViewModelBase
{
    private readonly ConfigurationService _configService;
    private readonly IDialogService _dialogService;

    private string _serverRoot = string.Empty;
    private string _currentMinecraftVersion = string.Empty;
    private string _logDirectory = string.Empty;

    public SettingsViewModel(ConfigurationService configService, IDialogService dialogService)
    {
        _configService = configService;
        _dialogService = dialogService;

        // Load settings on initialization
        _ = LoadSettingsAsync();
    }

    /// <summary>
    /// Server root directory path
    /// </summary>
    public string ServerRoot
    {
        get => _serverRoot;
        set => SetProperty(ref _serverRoot, value);
    }

    /// <summary>
    /// Current Minecraft version from configuration
    /// </summary>
    public string CurrentMinecraftVersion
    {
        get => _currentMinecraftVersion;
        set => SetProperty(ref _currentMinecraftVersion, value);
    }

    /// <summary>
    /// Log directory path
    /// </summary>
    public string LogDirectory
    {
        get => _logDirectory;
        set => SetProperty(ref _logDirectory, value);
    }

    /// <summary>
    /// Loads settings from configuration.json
    /// </summary>
    private async Task LoadSettingsAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Loading settings...";

            var config = await _configService.LoadConfigurationAsync();

            ServerRoot = config.ServerRoot;
            CurrentMinecraftVersion = config.CurrentMinecraftVersion;
            LogDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Logs");

            StatusMessage = "Settings loaded";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error loading settings: {ex.Message}";
            await _dialogService.ShowErrorAsync("Settings Error", ex.Message);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Saves settings to configuration.json
    /// </summary>
    [RelayCommand]
    private async Task SaveSettingsAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Saving settings...";

            var config = new ServerConfiguration
            {
                ServerRoot = ServerRoot,
                CurrentMinecraftVersion = CurrentMinecraftVersion
            };

            await _configService.SaveConfigurationAsync(config);

            StatusMessage = "Settings saved successfully";
            await _dialogService.ShowInfoAsync("Settings Saved", "Settings have been saved successfully.");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error saving settings: {ex.Message}";
            await _dialogService.ShowErrorAsync("Save Error", ex.Message);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Opens folder browser dialog to select server root
    /// </summary>
    [RelayCommand]
    private async Task BrowseServerRootAsync()
    {
        try
        {
            var selectedPath = await _dialogService.ShowFolderBrowserAsync(
                "Select Server Root Directory",
                ServerRoot);

            if (!string.IsNullOrEmpty(selectedPath))
            {
                ServerRoot = selectedPath;
                StatusMessage = $"Server root set to: {selectedPath}";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error selecting folder: {ex.Message}";
            await _dialogService.ShowErrorAsync("Folder Selection Error", ex.Message);
        }
    }

    /// <summary>
    /// Resets settings to defaults
    /// </summary>
    [RelayCommand]
    private async Task ResetDefaultsAsync()
    {
        var confirm = await _dialogService.ShowConfirmAsync(
            "Reset Settings",
            "Are you sure you want to reset settings to defaults?");

        if (!confirm)
            return;

        ServerRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "MinecraftServers");
        CurrentMinecraftVersion = "Unknown";
        StatusMessage = "Settings reset to defaults (not saved yet)";
    }
}
