using System.Diagnostics;

namespace MinecraftServerManager.Core.Models;

/// <summary>
/// Represents a Minecraft Bedrock server instance
/// Ported from MinecraftServer.ps1
/// </summary>
public class MinecraftServer
{
    private static readonly string[] RequiredFiles =
    {
        "bedrock_server.exe",
        "server.properties",
        "allowlist.json",
        "permissions.json"
    };

    public string RootPath { get; private set; }
    public string Name { get; private set; }
    public string Version { get; private set; }
    public ServerProperties Properties { get; private set; }
    public bool IsRunning { get; set; }
    public int? ProcessId { get; set; }

    private MinecraftServer(string rootPath)
    {
        RootPath = rootPath;
        Name = Path.GetFileName(rootPath);
        Properties = new ServerProperties();
        Version = "Unknown";
    }

    /// <summary>
    /// Creates and initializes a MinecraftServer instance
    /// </summary>
    public static async Task<MinecraftServer> CreateAsync(string rootPath)
    {
        var server = new MinecraftServer(rootPath);
        await server.LoadPropertiesAsync();
        await server.LoadVersionAsync();
        await server.UpdateRunningStatusAsync();
        return server;
    }

    /// <summary>
    /// Validates that all required files exist
    /// </summary>
    public bool ValidateRequiredFiles()
    {
        return RequiredFiles.All(file => File.Exists(Path.Combine(RootPath, file)));
    }

    /// <summary>
    /// Loads version from currentVersion.json
    /// Ported from LoadVersion() in MinecraftServer.ps1:15-36
    /// </summary>
    private async Task LoadVersionAsync()
    {
        var versionFile = Path.Combine(RootPath, "currentVersion.json");

        if (!File.Exists(versionFile))
        {
            Version = "Unknown";
            return;
        }

        try
        {
            var json = await File.ReadAllTextAsync(versionFile);
            var versionInfo = System.Text.Json.JsonSerializer.Deserialize<VersionInfo>(json);
            Version = versionInfo?.Version ?? "Unknown";
        }
        catch
        {
            Version = "Unknown";
        }
    }

    /// <summary>
    /// Loads server.properties file
    /// Ported from LoadProperties() in MinecraftServer.ps1:38-62
    /// </summary>
    private async Task LoadPropertiesAsync()
    {
        var propertiesFile = Path.Combine(RootPath, "server.properties");

        if (!File.Exists(propertiesFile))
        {
            return;
        }

        try
        {
            Properties = await ServerProperties.ParseAsync(propertiesFile);
        }
        catch
        {
            // Properties remain empty if parse fails
        }
    }

    /// <summary>
    /// Checks if the server process is currently running
    /// Ported from logic in MinecraftServer.ps1:102-104
    /// </summary>
    public async Task UpdateRunningStatusAsync()
    {
        await Task.Run(() =>
        {
            var exePath = Path.Combine(RootPath, "bedrock_server.exe");
            var processes = Process.GetProcessesByName("bedrock_server");

            foreach (var process in processes)
            {
                try
                {
                    // Compare the executable path
                    if (process.MainModule?.FileName?.Equals(exePath, StringComparison.OrdinalIgnoreCase) == true)
                    {
                        IsRunning = true;
                        ProcessId = process.Id;
                        return;
                    }
                }
                catch
                {
                    // Process may have exited, continue checking others
                }
                finally
                {
                    process.Dispose();
                }
            }

            IsRunning = false;
            ProcessId = null;
        });
    }

    /// <summary>
    /// Starts the server process
    /// Ported from Start() in MinecraftServer.ps1:98-110
    /// </summary>
    public async Task StartAsync()
    {
        if (IsRunning)
        {
            return; // Already running
        }

        var exePath = Path.Combine(RootPath, "bedrock_server.exe");

        if (!File.Exists(exePath))
        {
            throw new FileNotFoundException($"bedrock_server.exe not found in {RootPath}");
        }

        await Task.Run(() =>
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = RootPath,
                    UseShellExecute = false,
                    CreateNoWindow = false
                }
            };

            process.Start();
            ProcessId = process.Id;
            IsRunning = true;
        });
    }

    /// <summary>
    /// Stops the server process
    /// Ported from Stop() in MinecraftServer.ps1:112-122
    /// </summary>
    public async Task StopAsync()
    {
        await Task.Run(() =>
        {
            var exePath = Path.Combine(RootPath, "bedrock_server.exe");
            var processes = Process.GetProcesses();

            foreach (var process in processes)
            {
                try
                {
                    if (process.ProcessName.Equals("bedrock_server", StringComparison.OrdinalIgnoreCase))
                    {
                        // Check if it's our server by comparing path
                        if (process.MainModule?.FileName?.Equals(exePath, StringComparison.OrdinalIgnoreCase) == true)
                        {
                            process.Kill();
                            process.WaitForExit(5000); // Wait up to 5 seconds
                        }
                    }
                }
                catch
                {
                    // Process may have already exited
                }
                finally
                {
                    process.Dispose();
                }
            }

            IsRunning = false;
            ProcessId = null;
        });
    }

    public override string ToString()
    {
        return $"MinecraftServer: {Name} {Properties.Gamemode}";
    }

    public string GetFullDescription()
    {
        return $"{ToString()} [Version: {Version}] [{RootPath}] Port:{Properties.ServerPort}, v6:{Properties.ServerPortV6}";
    }
}
