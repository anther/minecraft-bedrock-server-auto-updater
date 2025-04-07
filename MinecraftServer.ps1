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
            Start-Process -FilePath $exe
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