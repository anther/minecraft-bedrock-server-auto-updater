using CommunityToolkit.Mvvm.ComponentModel;

namespace MinecraftServerManager.WPF.ViewModels;

/// <summary>
/// Base class for all ViewModels, providing common functionality
/// </summary>
public abstract class ViewModelBase : ObservableObject
{
    private bool _isBusy;
    private string _statusMessage = string.Empty;

    /// <summary>
    /// Indicates if the ViewModel is performing a long-running operation
    /// </summary>
    public bool IsBusy
    {
        get => _isBusy;
        set => SetProperty(ref _isBusy, value);
    }

    /// <summary>
    /// Status message for displaying operation status to the user
    /// </summary>
    public string StatusMessage
    {
        get => _statusMessage;
        set => SetProperty(ref _statusMessage, value);
    }
}
