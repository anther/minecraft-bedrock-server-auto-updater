param(
    [string]$Address = "127.0.0.1",
    [int]$Port = 19132,
    [int]$TimeoutMs = 3000
)

# RakNet Unconnected Ping (0x01)
# Format: PacketID(1) + Timestamp(8) + Magic(16) + ClientGUID(8)
$magic = [byte[]]@(0x00,0xFF,0xFF,0x00,0xFE,0xFE,0xFE,0xFE,0xFD,0xFD,0xFD,0xFD,0x12,0x34,0x56,0x78)
$timestamp = [BitConverter]::GetBytes([long](Get-Date).Ticks)
[Array]::Reverse($timestamp) # big-endian
$clientGuid = [byte[]]@(0,0,0,0,0,0,0,1)

$ping = [byte[]]@(0x01) + $timestamp + $magic + $clientGuid

try {
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Client.ReceiveTimeout = $TimeoutMs
    $udp.Connect($Address, $Port)
    [void]$udp.Send($ping, $ping.Length)

    $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
    $response = $udp.Receive([ref]$endpoint)

    if ($response[0] -eq 0x1C) {
        # Unconnected Pong - extract the server info string
        # Skip: PacketID(1) + Timestamp(8) + ServerGUID(8) + Magic(16) + StringLength(2) = 35 bytes
        $strLen = ($response[33] -shl 8) + $response[34]
        $serverInfo = [System.Text.Encoding]::UTF8.GetString($response, 35, $strLen)
        $fields = $serverInfo -split ";"

        Write-Host ""
        Write-Host "  Server is ONLINE at ${Address}:${Port}" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Edition:      $($fields[0])"
        Write-Host "  MOTD:         $($fields[1])"
        Write-Host "  Protocol:     $($fields[2])"
        Write-Host "  Version:      $($fields[3])"
        Write-Host "  Players:      $($fields[4])/$($fields[5])"
        if ($fields.Count -gt 7) { Write-Host "  World:        $($fields[7])" }
        if ($fields.Count -gt 8) { Write-Host "  Gamemode:     $($fields[8])" }
        Write-Host ""
    } else {
        Write-Host "Unexpected response packet ID: 0x$($response[0].ToString('X2'))" -ForegroundColor Yellow
    }
} catch [System.Net.Sockets.SocketException] {
    Write-Host ""
    Write-Host "  No response from ${Address}:${Port} - server appears OFFLINE" -ForegroundColor Red
    Write-Host ""
} finally {
    if ($udp) { $udp.Close() }
}
