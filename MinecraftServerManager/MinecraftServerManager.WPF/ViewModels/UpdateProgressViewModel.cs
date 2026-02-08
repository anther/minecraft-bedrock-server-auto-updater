using CommunityToolkit.Mvvm.Input;
using MinecraftServerManager.Core.Models;
using MinecraftServerManager.Core.Services;
using System.Collections.ObjectModel;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel for tracking update progress
/// </summary>
public partial class UpdateProgressViewModel : ViewModelBase
{
    private readonly ServerManager _serverManager;
    private readonly LoggingService _logger;

    private string _currentMessage = string.Empty;
    private double _progressPercentage;
    private UpdateStage _currentStage = UpdateStage.Initializing;
    private bool _isUpdating;
    private ObservableCollection<string> _detailedLogs = new();
    private CancellationTokenSource? _cancellationTokenSource;

    public UpdateProgressViewModel(ServerManager serverManager, LoggingService logger)
    {
        _serverManager = serverManager;
        _logger = logger;
    }

    /// <summary>
    /// Current progress message
    /// </summary>
    public string CurrentMessage
    {
        get => _currentMessage;
        set => SetProperty(ref _currentMessage, value);
    }

    /// <summary>
    /// Progress percentage (0-100)
    /// </summary>
    public double ProgressPercentage
    {
        get => _progressPercentage;
        set => SetProperty(ref _progressPercentage, value);
    }

    /// <summary>
    /// Current update stage
    /// </summary>
    public UpdateStage CurrentStage
    {
        get => _currentStage;
        set => SetProperty(ref _currentStage, value);
    }

    /// <summary>
    /// Whether an update is currently running
    /// </summary>
    public bool IsUpdating
    {
        get => _isUpdating;
        set => SetProperty(ref _isUpdating, value);
    }

    /// <summary>
    /// Detailed log entries for the update process
    /// </summary>
    public ObservableCollection<string> DetailedLogs
    {
        get => _detailedLogs;
        set => SetProperty(ref _detailedLogs, value);
    }

    /// <summary>
    /// Starts the update process
    /// </summary>
    public async Task StartUpdateAsync()
    {
        try
        {
            IsUpdating = true;
            IsBusy = true;
            DetailedLogs.Clear();
            _cancellationTokenSource = new CancellationTokenSource();

            AddLog("Starting update cycle...");

            var progress = new Progress<UpdateProgress>(update =>
            {
                CurrentMessage = update.Message;
                ProgressPercentage = update.Percentage;
                CurrentStage = update.Stage;
                AddLog($"[{update.Stage}] {update.Message}");
            });

            var result = await _serverManager.RunFullUpdateCycleAsync(progress, _cancellationTokenSource.Token);

            HandleUpdateResult(result);
        }
        catch (OperationCanceledException)
        {
            AddLog("Update cancelled by user");
            StatusMessage = "Update cancelled";
            _logger.LogWarning("Update cancelled by user");
        }
        catch (Exception ex)
        {
            AddLog($"ERROR: {ex.Message}");
            StatusMessage = $"Update failed: {ex.Message}";
            _logger.LogError("Update failed", ex);
        }
        finally
        {
            IsUpdating = false;
            IsBusy = false;
            _cancellationTokenSource?.Dispose();
            _cancellationTokenSource = null;
        }
    }

    /// <summary>
    /// Cancels the update process
    /// </summary>
    [RelayCommand(CanExecute = nameof(IsUpdating))]
    private void CancelUpdate()
    {
        _cancellationTokenSource?.Cancel();
        AddLog("Cancellation requested...");
    }

    private void HandleUpdateResult(UpdateResult result)
    {
        switch (result)
        {
            case UpdateResult.Success:
                AddLog("Update completed successfully!");
                StatusMessage = "Update completed successfully";
                break;
            case UpdateResult.NoUpdateAvailable:
                AddLog("No update available");
                StatusMessage = "Already up to date";
                break;
            case UpdateResult.Failed:
                AddLog("Update failed");
                StatusMessage = "Update failed";
                break;
        }
    }

    private void AddLog(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss");
        DetailedLogs.Add($"[{timestamp}] {message}");
    }
}
