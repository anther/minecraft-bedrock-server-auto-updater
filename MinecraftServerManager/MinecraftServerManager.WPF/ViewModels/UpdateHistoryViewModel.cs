using CommunityToolkit.Mvvm.Input;
using MinecraftServerManager.Core.Models;
using MinecraftServerManager.Core.Services;
using System.Collections.ObjectModel;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// ViewModel for displaying update history
/// </summary>
public partial class UpdateHistoryViewModel : ViewModelBase
{
    private readonly LoggingService _logger;

    private ObservableCollection<UpdateHistoryEntry> _historyEntries = new();
    private UpdateHistoryEntry? _selectedEntry;

    public UpdateHistoryViewModel(LoggingService logger)
    {
        _logger = logger;

        // Load history on initialization
        _ = RefreshHistoryAsync();
    }

    /// <summary>
    /// Collection of update history entries
    /// </summary>
    public ObservableCollection<UpdateHistoryEntry> HistoryEntries
    {
        get => _historyEntries;
        set => SetProperty(ref _historyEntries, value);
    }

    /// <summary>
    /// Currently selected history entry
    /// </summary>
    public UpdateHistoryEntry? SelectedEntry
    {
        get => _selectedEntry;
        set => SetProperty(ref _selectedEntry, value);
    }

    /// <summary>
    /// Number of history entries
    /// </summary>
    public int EntryCount => HistoryEntries.Count;

    /// <summary>
    /// Loads update history from the JSON file
    /// </summary>
    [RelayCommand]
    private async Task RefreshHistoryAsync()
    {
        try
        {
            IsBusy = true;
            StatusMessage = "Loading update history...";

            var history = await _logger.ReadUpdateHistoryAsync();

            HistoryEntries.Clear();
            foreach (var entry in history.OrderByDescending(e => e.LastUpdatedAt))
            {
                HistoryEntries.Add(entry);
            }

            StatusMessage = $"Loaded {HistoryEntries.Count} history entry(ies)";
            OnPropertyChanged(nameof(EntryCount));
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error loading history: {ex.Message}";
            _logger.LogError(StatusMessage, ex);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
