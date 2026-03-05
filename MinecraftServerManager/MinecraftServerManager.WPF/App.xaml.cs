using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using MinecraftServerManager.Core.Services;
using MinecraftServerManager.WPF.Services;
using MinecraftServerManager.WPF.ViewModels;
using MinecraftServerManager.WPF.Views;

namespace MinecraftServerManager.WPF;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    private ServiceProvider? _serviceProvider;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Configure Dependency Injection
        var services = new ServiceCollection();

        // Register Core Services
        var logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Logs");
        var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configuration.json");

        services.AddSingleton(new LoggingService(logDirectory));
        services.AddSingleton(sp => new ConfigurationService(configPath, sp.GetRequiredService<LoggingService>()));
        services.AddSingleton<ServerDiscoveryService>();
        services.AddSingleton<VersionCheckerService>();
        services.AddSingleton<DownloadService>();
        services.AddSingleton<UpdateService>();
        services.AddSingleton<ServerManager>();

        // Register WPF Services
        services.AddSingleton<IDialogService, DialogService>();

        // Register ViewModels
        services.AddTransient<MainWindowViewModel>();
        services.AddTransient<ServerListViewModel>();
        services.AddTransient<ServerDetailsViewModel>();
        services.AddTransient<UpdateProgressViewModel>();
        services.AddTransient<UpdateHistoryViewModel>();
        services.AddTransient<SettingsViewModel>();

        // Register Views
        services.AddTransient<MainWindow>();

        // Build ServiceProvider
        _serviceProvider = services.BuildServiceProvider();

        // Show MainWindow
        var mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
        mainWindow.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _serviceProvider?.Dispose();
        base.OnExit(e);
    }
}
