class MinecraftServer
{
    [string]$Root
    [string]$Version
    [hashtable]$Properties

    MinecraftServer([string]$rootPath)
    {
        $this.Root = $rootPath
        $this.Properties = @{ }
        $this.LoadProperties()
        $this.Version = $this.LoadVersion()
    }

    [string]
    LoadVersion()
    {
        $versionFile = Join-Path $this.Root 'currentVersion.json'
        if (Test-Path $versionFile)
        {
            try
            {
                $versionInfo = Get-Content $versionFile | ConvertFrom-Json
                return $versionInfo.Version
            }
            catch
            {
                Write-Log "Error reading version info from $versionFile"
                return "Unknown"
            }
        }
        else
        {
            return "Unknown"
        }
    }

    [void]
    LoadProperties()
    {
        $propertiesFile = Join-Path $this.Root 'server.properties'
        if (Test-Path $propertiesFile)
        {
            foreach ($line in Get-Content $propertiesFile)
            {
                # Ignore comments and empty lines
                if ($line -match '^\s*#' -or $line -match '^\s*$')
                {
                    continue
                }
                # Split the line into key and value
                $key, $value = $line -split '=', 2
                $key = $key.Trim()
                $value = $value.Trim()
                $this.Properties[$key] = $value
            }
        }
        else
        {
            Write-Log "server.properties not found in $( $this.Root )"
        }
    }

    [string]
    GetRoot()
    {
        return $this.Root
    }

    [string]
    GetName()
    {
        return Split-Path $this.Root -Leaf
    }

    [string]
    ToString()
    {
        return "MinecraftServer: $($this.GetName() ) $($this.GetProperty('gamemode') )"
    }

    [string]
    GetFullDescription()
    {
        return "$($this.toString() ) [Version: $( $this.Version )] [$( $this.Root )] Port:$($this.GetProperty('server-port') ), v6:$($this.GetProperty('server-portv6') )"
    }

    [string]
    GetProperty([string]$key)
    {
        if ( $this.Properties.ContainsKey($key))
        {
            return $this.Properties[$key]
        }
        return $null
    }

    [bool]
    IsLanVisible()
    {
        # Bedrock's enable-lan-visibility must be true for the server to broadcast
        # its status. When false, the RakNet ping returns no server-info string, so
        # the dashboard shows it offline and it cannot be joined over LAN.
        # The property defaults to true when absent, so only an explicit "false" is a problem.
        # GetProperty is [string]-typed, so an absent key comes back as '' (not $null).
        $val = $this.GetProperty('enable-lan-visibility')
        if ([string]::IsNullOrWhiteSpace($val))
        {
            return $true
        }
        return ($val.Trim().ToLower() -eq 'true')
    }

    [void]
    Start()
    {
        $exe = Join-Path $this.Root 'bedrock_server.exe'
        $running = Get-WmiObject Win32_Process | Where-Object {
            $_.Name -eq 'bedrock_server.exe' -and $_.ExecutablePath -like "$( $this.Root )\*"
        }
        if (-not$running)
        {
            Write-Log "Starting server: $($this.GetName() )"

            # Capture the server's console output to a file so problems can be diagnosed
            # after the fact. Storage is bounded: we keep only the current run (latest.log)
            # plus the immediately preceding run (previous.log). Each start rotates the old
            # latest to previous, so logs never accumulate indefinitely.
            $logDir = Join-Path $this.Root 'console-logs'
            if (-not (Test-Path $logDir))
            {
                New-Item -ItemType Directory -Path $logDir | Out-Null
            }
            $latestOut = Join-Path $logDir 'latest.log'
            $prevOut = Join-Path $logDir 'previous.log'
            $latestErr = Join-Path $logDir 'latest.err.log'
            $prevErr = Join-Path $logDir 'previous.err.log'
            if (Test-Path $latestOut) { Move-Item -Path $latestOut -Destination $prevOut -Force }
            if (Test-Path $latestErr) { Move-Item -Path $latestErr -Destination $prevErr -Force }

            Start-Process -FilePath $exe -WorkingDirectory $this.Root -WindowStyle Hidden `
                -RedirectStandardOutput $latestOut -RedirectStandardError $latestErr
        }
    }

    [void]
    Stop()
    {
        $exe = Join-Path $this.Root 'bedrock_server.exe'
        $processes = Get-Process | Where-Object { $_.Path -eq $exe } -ErrorAction SilentlyContinue
        foreach ($p in $processes)
        {
            Write-Log "Stopping server: $($this.GetName() ) (PID $( $p.Id ))"
            Stop-Process -Id $p.Id -Force
        }
    }
}