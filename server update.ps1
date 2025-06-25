. "$PSScriptRoot\MinecraftServer.ps1"

#=== LOGGING ===#
function Write-Log
{
    Param ([string]$msg)
    $stamp = (Get-Date).ToString("[yyyy-MM-dd HH:mm:ss.fff]")
    $logMessage = "$stamp $msg"
    Add-Content $scriptLogFile -Value $logMessage
    Write-Host $logMessage
}

#=== VALID SERVER DETECTION ===#
function Get-ValidServerRoots
{
    $requiredFiles = @("bedrock_server.exe", "permissions.json", "allowlist.json", "server.properties")
    $validServers = @()

    $configPath = "$PSScriptRoot\configuration.json"
    if (!(Test-Path $configPath)) {
        Write-Log "ERROR: configuration.json not found."
        exit 1
    }

    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $serverRootPath = $config.serverRoot
        if (-not $serverRootPath) {
            $serverRootPath = ".\servers"
        }
        $serverRootPath = Resolve-Path -Path $serverRootPath
    } catch {
        Write-Log "ERROR: Failed to read or parse configuration.json: $_"
        exit 1
    }

    Write-Log "Using serverRoot path: $serverRootPath"

    $serverRoots = Get-ChildItem -Path $serverRootPath -Directory | Select-Object -ExpandProperty FullName
    Write-Log "Searching for Server Roots by searching for existence of files: $( $requiredFiles -join ', ' )"

    foreach ($serverRoot in $serverRoots)
    {
        $allFilesExist = $true
        foreach ($file in $requiredFiles)
        {
            if (-not(Test-Path (Join-Path $serverRoot $file)))
            {
                Write-Log "Not Server Root: Missing $file in $serverRoot"
                $allFilesExist = $false
                break
            }
        }

        if ($allFilesExist)
        {
            $server = [MinecraftServer]::new($serverRoot)
            $validServers += $server
            Write-Log "Found Server Root: $($server.GetFullDescription() )"
        }
    }

    return $validServers
}


#=== UPDATE HISTORY ===#
function Write-UpdateHistory
{
    Param (
        [string]$version,
        [string]$updateTime
    )

    # Initialize an empty array if no history file exists
    if (!(Test-Path $updateHistoryFile))
    {
        $empty = @() | ConvertTo-Json
        $empty | Set-Content $updateHistoryFile
    }

    $historyJson = @()

    # Try to load existing history if file exists
    if (Test-Path $updateHistoryFile)
    {
        try
        {
            $rawJson = Get-Content $updateHistoryFile -Raw
            if ( $rawJson.Trim())
            {
                $historyJson = $rawJson | ConvertFrom-Json
            }
        }
        catch
        {
            Write-Log "ERROR reading update history file: $_"
        }
    }

    # Check if version already exists in history
    $existingEntry = $historyJson | Where-Object { $_.Version -eq $version }
    if ($existingEntry)
    {
        # Update existing entry
        $existingEntry.LastUpdatedAt = $updateTime
        $existingEntry.TimesUpdated += 1
    }
    else
    {
        # Add new entry for new version
        $newEntry = [PSCustomObject]@{
            Version = $version
            FirstUpdatedAt = $updateTime
            LastUpdatedAt = $updateTime
            TimesUpdated = 1
        }
        $historyJson += $newEntry
    }

    # Write updated history back to file
    $historyJson | ConvertTo-Json -Depth 10 | Set-Content $updateHistoryFile

    Write-Log "Updated history with version $version"
}

#=== DOWNLOAD AND PROCESS ===#
function Get-ServerZip
{
    [Net.ServicePointManager]::SecurityProtocol = "tls12, tls11, tls"

    $configPath = ".\configuration.json"
    if (!(Test-Path $configPath)) {
        Write-Log "ERROR: configuration.json not found."
        exit 1
    }

    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $version = $config.currentMinecraftVersion
        if (-not $version) {
            throw "Missing 'currentMinecraftVersion' in config"
        }
        Write-Log "Latest version in configuration: $version"
    } catch {
        Write-Log "ERROR: Failed to read or parse configuration.json: $_"
    }

    $latestVersion = $null
    try {
        $apiUrl = 'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links'
        Write-Log "Attempting to fetch version from api url $apiUrl"
        $apiResponse = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -TimeoutSec 10

        $bedrockLink = $apiResponse.result.links | Where-Object { $_.downloadType -eq 'serverBedrockWindows' } | Select-Object -First 1
        if ($bedrockLink -and $bedrockLink.downloadUrl -match "bedrock-server-([0-9\.]+)\.zip") {
            $latestVersion = $matches[1]
            if ($latestVersion -ne $version) {
                Write-Log "Newer version detected: $latestVersion (was $version). Updating configuration.json..."

                $newJson = @{ currentMinecraftVersion = $latestVersion } | ConvertTo-Json -Depth 2
                Set-Content -Path $configPath -Value $newJson -Encoding UTF8

                $version = $latestVersion
            }
        }
    } catch {
        Write-Log "WARNING: Could not fetch latest version from API. Using configured version $version."
    }

    $filename = "bedrock-server-$version.zip"
    $downloadUrl = "https://www.minecraft.net/bedrockdedicatedserver/bin-win/$filename"
    $tempDir = "$env:TEMP\MinecraftBedrockUpdate"
    $zipPath = "$tempDir\$filename"

    if (!(Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    if (!(Test-Path $zipPath)) {
        Write-Log "Downloading: $filename to: $zipPath"
        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
        } catch {
            Write-Log "ERROR: Failed to download ${filename}: $_"
            exit 1
        }
    } else {
        Write-Log "Zip already downloaded: $filename"
    }

    return @{ ZipPath = $zipPath; Version = $version }
}

function Open-DownloadedServer
{
    Param (
        [string]$zipPath,
        [string]$version
    )

    $extractDir = "$env:TEMP\MinecraftBedrockUpdate\extracted"
    $versionFilePath = "$extractDir\currentVersion.json"

    if (Test-Path $versionFilePath)
    {
        try
        {
            $existingVersionInfo = Get-Content $versionFilePath | ConvertFrom-Json
            if ($existingVersionInfo.Version -eq $version)
            {
                Write-Log "Extracted folder already contains version $version. Skipping extraction."
                return $extractDir
            }
            else
            {
                Write-Log "Extracted version ($( $existingVersionInfo.Version )) differs. Re-extracting..."
            }
        }
        catch
        {
            Write-Log "Failed to read version info. Re-extracting."
        }
    }
    elseif (Test-Path $extractDir)
    {
        Write-Log "No version file found. Cleaning up and re-extracting..."
    }

    if (Test-Path $extractDir)
    {
        Remove-Item -Recurse -Force -Path $extractDir
    }

    Write-Log "Extracting Zip To: $extractDir"
    New-Item -ItemType Directory -Path $extractDir | Out-Null
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    Write-Log "Extracted to: $extractDir"

    foreach ($file in @("server.properties", "allowlist.json", "permissions.json"))
    {
        $path = Join-Path $extractDir $file
        if (Test-Path $path)
        {
            Remove-Item $path -Force
        }
    }

    $versionInfo = @{ Version = $version }
    $versionInfo | ConvertTo-Json | Set-Content -Path $versionFilePath

    return $extractDir
}

#=== SERVER UPDATE ===#
function Update-Server
{
    param (
        [MinecraftServer]$server,
        [string]$tempExtractDir
    )

    $gameDir = $server.GetRoot()
    $targetVersionFile = "$gameDir\currentVersion.json"
    $incomingVersionFile = "$tempExtractDir\currentVersion.json"

    if (Test-Path $targetVersionFile)
    {
        $current = (Get-Content $targetVersionFile | ConvertFrom-Json).Version
        $incoming = (Get-Content $incomingVersionFile | ConvertFrom-Json).Version
        if ($current -eq $incoming)
        {
            Write-Log "No update needed for $($server.GetName() )"
            return
        }
    }
    else
    {
        Write-Log "No currentVersion.json found, performing server update"
    }

    Write-Log "Updating server at: $gameDir"
    $server.Stop()

    $backupDir = "$gameDir\BACKUP"
    if (!(Test-Path $backupDir))
    {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    foreach ($file in @("server.properties", "allowlist.json", "permissions.json"))
    {
        if (Test-Path "$gameDir\$file")
        {
            Copy-Item "$gameDir\$file" $backupDir -Force
        }
    }

    Copy-Item "$tempExtractDir\*" $gameDir -Recurse -Force

    foreach ($file in @("server.properties", "allowlist.json", "permissions.json"))
    {
        if (Test-Path "$backupDir\$file")
        {
            Copy-Item "$backupDir\$file" $gameDir -Force
        }
    }

    Write-Log "Update applied to $($server.GetName() )"
}

#=== CONFIGURATION ===#
$scriptLogFile = "$PSScriptRoot\logs\MinecraftScriptLog.log"
$updateHistoryFile = "$PSScriptRoot\logs\MinecraftUpdateHistory.json"

$serverRoots = Get-ValidServerRoots
$download = Get-ServerZip
$extractDirectory = Open-DownloadedServer -zipPath $download.ZipPath -version $download.Version

foreach ($server in $serverRoots)
{
    Update-Server -server $server -tempExtractDir $extractDirectory
}

foreach ($server in $serverRoots)
{
    $server.Start()
}

Write-UpdateHistory -version $download.Version -updateTime (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

exit 0