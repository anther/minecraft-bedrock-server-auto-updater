namespace MinecraftServerManager.WPF.Services;

/// <summary>
/// Service for displaying dialog messages to the user
/// </summary>
public interface IDialogService
{
    /// <summary>
    /// Shows an error dialog
    /// </summary>
    Task ShowErrorAsync(string title, string message);

    /// <summary>
    /// Shows an informational dialog
    /// </summary>
    Task ShowInfoAsync(string title, string message);

    /// <summary>
    /// Shows a confirmation dialog and returns the user's choice
    /// </summary>
    Task<bool> ShowConfirmAsync(string title, string message);

    /// <summary>
    /// Shows a folder browser dialog and returns the selected path
    /// </summary>
    Task<string?> ShowFolderBrowserAsync(string title, string? initialPath = null);
}
