using System.Windows;
using Microsoft.Win32;

namespace MinecraftServerManager.WPF.Services;

/// <summary>
/// Implementation of IDialogService using WPF MessageBox and dialogs
/// </summary>
public class DialogService : IDialogService
{
    public Task ShowErrorAsync(string title, string message)
    {
        MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Error);
        return Task.CompletedTask;
    }

    public Task ShowInfoAsync(string title, string message)
    {
        MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Information);
        return Task.CompletedTask;
    }

    public Task<bool> ShowConfirmAsync(string title, string message)
    {
        var result = MessageBox.Show(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question);
        return Task.FromResult(result == MessageBoxResult.Yes);
    }

    public Task<string?> ShowFolderBrowserAsync(string title, string? initialPath = null)
    {
        var dialog = new OpenFolderDialog
        {
            Title = title,
            InitialDirectory = initialPath ?? Environment.GetFolderPath(Environment.SpecialFolder.MyComputer)
        };

        var result = dialog.ShowDialog();
        return Task.FromResult(result == true ? dialog.FolderName : null);
    }
}
