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
    $serverRoots = Get-ChildItem -Path $PSScriptRoot -Directory | Select-Object -ExpandProperty FullName

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

    $webRequestParams = @{
        UseBasicParsing = $true
        Uri = 'https://www.minecraft.net/en-us/download/server/bedrock'
        TimeoutSec = 10
        Headers = @{
            "accept" = "*/*"
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
        }
    }

    try
    {
        $page = Invoke-WebRequest @webRequestParams
        $serverLink = $page.Links | Where-Object { $_.href -like "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server*" } | Select-Object -First 1
        $downloadUrl = $serverLink.href
        $filename = $downloadUrl.Replace("https://www.minecraft.net/bedrockdedicatedserver/bin-win/", "")
    }
    catch
    {
        Write-Log "ERROR: Failed to fetch Minecraft Bedrock server page."
        exit 1
    }

    if ($filename -match "bedrock-server-([0-9\.]+)\.zip")
    {
        $version = $matches[1]
    }
    else
    {
        $version = "unknown"
    }

    $tempDir = "$env:TEMP\MinecraftBedrockUpdate"
    $zipPath = "$tempDir\$filename"
    if (!(Test-Path $tempDir))
    {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    if (!(Test-Path $zipPath))
    {
        Write-Log "Downloading: $filename"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
    }
    else
    {
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
$scriptLogFile = "$PSScriptRoot\MinecraftScriptLog.log"
$updateHistoryFile = "$PSScriptRoot\MinecraftUpdateHistory.json"

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