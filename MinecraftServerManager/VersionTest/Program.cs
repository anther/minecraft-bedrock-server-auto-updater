using MinecraftServerManager.Core.Services;

Console.WriteLine("=== Minecraft Bedrock Server Version Checker ===\n");

// Create a temporary logs directory for testing
var logsDir = Path.Combine(Directory.GetCurrentDirectory(), "logs");
Directory.CreateDirectory(logsDir);

// Initialize services
var logger = new LoggingService(logsDir);
var versionChecker = new VersionCheckerService(logger);

// Fetch the latest version
Console.WriteLine("Fetching latest Minecraft Bedrock server version...\n");

try
{
    var (version, downloadUrl) = await versionChecker.GetLatestVersionAsync("1.21.0");

    Console.WriteLine($"✅ Success!");
    Console.WriteLine($"   Latest Version: {version}");
    Console.WriteLine($"   Download URL: {downloadUrl}");
    Console.WriteLine($"\nLog file created at: {Path.Combine(logsDir, "MinecraftScriptLog.log")}");
}
catch (Exception ex)
{
    Console.WriteLine($"❌ Error: {ex.Message}");
    logger.LogError("Failed to fetch version", ex);
}
