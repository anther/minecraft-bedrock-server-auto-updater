using MinecraftServerManager.Core.Models;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace MinecraftServerManager.Core.Services;

/// <summary>
/// Queries Minecraft Bedrock servers for real-time player information using the Query Protocol
/// </summary>
public class QueryService
{
    private readonly LoggingService _logger;
    private const int QueryTimeoutMs = 5000;
    private const byte TypeHandshake = 0x09;
    private const byte TypeStat = 0x00;
    private static readonly Random _random = new();

    public QueryService(LoggingService logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Queries a Minecraft server for real-time player information
    /// </summary>
    public async Task<PlayerQueryResult> QueryServerAsync(MinecraftServer server)
    {
        // Skip if server not running (no need to query)
        if (!server.IsRunning)
        {
            return new PlayerQueryResult { Error = "Server not running" };
        }

        try
        {
            _logger.Log($"Querying player count for {server.Name}...");

            // Get query port from server.properties (defaults to server-port)
            var queryPort = GetQueryPort(server);
            var endpoint = new IPEndPoint(IPAddress.Loopback, queryPort);

            using var client = new UdpClient();
            client.Client.ReceiveTimeout = QueryTimeoutMs;
            client.Client.SendTimeout = QueryTimeoutMs;

            // Generate session ID
            var sessionId = _random.Next();

            // Step 1: Get challenge token
            var challengeToken = await GetChallengeTokenAsync(client, endpoint, sessionId);
            if (challengeToken == 0)
            {
                return new PlayerQueryResult { Error = "Failed to get challenge token" };
            }

            // Step 2: Get full stats
            var result = await GetFullStatsAsync(client, endpoint, sessionId, challengeToken);

            // Update server properties
            server.PlayerCount = result.PlayerCount;
            server.PlayerNames = result.PlayerNames;
            server.LastPlayerQueryTime = DateTime.Now;

            _logger.Log($"{server.Name}: {result.PlayerCount} players online");
            return result;
        }
        catch (SocketException ex)
        {
            _logger.LogWarning($"Socket error querying {server.Name}: {ex.Message}");
            return new PlayerQueryResult { Error = $"Socket error: {ex.Message}" };
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Failed to query {server.Name}: {ex.Message}");
            return new PlayerQueryResult { Error = ex.Message };
        }
    }

    /// <summary>
    /// Gets the query port from server properties
    /// </summary>
    private int GetQueryPort(MinecraftServer server)
    {
        // Try to get query.port from server.properties
        var queryPortStr = server.Properties.GetProperty("query.port");
        if (int.TryParse(queryPortStr, out var queryPort))
        {
            return queryPort;
        }

        // Fall back to server-port
        return server.Properties.ServerPort;
    }

    /// <summary>
    /// Sends handshake request and receives challenge token
    /// </summary>
    private async Task<int> GetChallengeTokenAsync(UdpClient client, IPEndPoint endpoint, int sessionId)
    {
        try
        {
            // Build handshake packet
            var packet = new List<byte>
            {
                0xFE, 0xFD, // Magic
                TypeHandshake, // Type
            };
            packet.AddRange(BitConverter.GetBytes(IPAddress.HostToNetworkOrder(sessionId)));

            // Send handshake
            await client.SendAsync(packet.ToArray(), packet.Count, endpoint);

            // Receive response
            var response = await client.ReceiveAsync();
            var data = response.Buffer;

            // Parse response
            // Format: [Type:1][SessionId:4][ChallengeToken:string]\0
            if (data.Length < 5 || data[0] != TypeHandshake)
            {
                return 0;
            }

            // Extract challenge token (null-terminated string after session ID)
            var tokenStr = Encoding.ASCII.GetString(data, 5, data.Length - 6); // Skip type+sessionId, remove null terminator
            if (int.TryParse(tokenStr, out var token))
            {
                return token;
            }

            return 0;
        }
        catch
        {
            return 0;
        }
    }

    /// <summary>
    /// Sends full stat request and parses response
    /// </summary>
    private async Task<PlayerQueryResult> GetFullStatsAsync(
        UdpClient client,
        IPEndPoint endpoint,
        int sessionId,
        int challengeToken)
    {
        try
        {
            // Build stat request packet
            var packet = new List<byte>
            {
                0xFE, 0xFD, // Magic
                TypeStat, // Type
            };
            packet.AddRange(BitConverter.GetBytes(IPAddress.HostToNetworkOrder(sessionId)));
            packet.AddRange(BitConverter.GetBytes(IPAddress.HostToNetworkOrder(challengeToken)));
            packet.AddRange(new byte[] { 0x00, 0x00, 0x00, 0x00 }); // Padding for full stat

            // Send stat request
            await client.SendAsync(packet.ToArray(), packet.Count, endpoint);

            // Receive response
            var response = await client.ReceiveAsync();
            var data = response.Buffer;

            // Parse response
            return ParseFullStatResponse(data);
        }
        catch (Exception ex)
        {
            return new PlayerQueryResult { Error = $"Stat query failed: {ex.Message}" };
        }
    }

    /// <summary>
    /// Parses the full stat response packet
    /// </summary>
    private PlayerQueryResult ParseFullStatResponse(byte[] data)
    {
        var result = new PlayerQueryResult();

        try
        {
            // Skip header: Type(1) + SessionId(4) + Padding(11 bytes of "splitnum\0\x80\0")
            var offset = 16;

            // Read K,V pairs until we hit a double null terminator
            var stats = new Dictionary<string, string>();
            while (offset < data.Length - 1)
            {
                // Check for section separator (0x00 0x01 player_)
                if (data[offset] == 0x00 && offset + 1 < data.Length && data[offset + 1] == 0x01)
                {
                    // Found player section
                    offset += 2;
                    break;
                }

                // Read key
                var key = ReadNullTerminatedString(data, ref offset);
                if (string.IsNullOrEmpty(key))
                    break;

                // Read value
                var value = ReadNullTerminatedString(data, ref offset);
                stats[key] = value;
            }

            // Extract common stats
            if (stats.TryGetValue("numplayers", out var numPlayersStr) && int.TryParse(numPlayersStr, out var numPlayers))
            {
                result.PlayerCount = numPlayers;
            }

            if (stats.TryGetValue("maxplayers", out var maxPlayersStr) && int.TryParse(maxPlayersStr, out var maxPlayers))
            {
                result.MaxPlayers = maxPlayers;
            }

            if (stats.TryGetValue("hostname", out var hostname))
            {
                result.Motd = hostname;
            }

            if (stats.TryGetValue("gametype", out var gametype))
            {
                result.GameType = gametype;
            }

            if (stats.TryGetValue("map", out var map))
            {
                result.Map = map;
            }

            // Read player names
            // Format: "player_\0\0" followed by null-terminated player names, ending with \0
            if (offset < data.Length)
            {
                // Skip "player_\0" header if present
                var playerHeader = ReadNullTerminatedString(data, ref offset);
                if (playerHeader == "player_")
                {
                    offset++; // Skip extra null
                }

                // Read player names until we hit a null terminator
                while (offset < data.Length)
                {
                    var playerName = ReadNullTerminatedString(data, ref offset);
                    if (string.IsNullOrEmpty(playerName))
                        break;

                    result.PlayerNames.Add(playerName);
                }
            }
        }
        catch (Exception ex)
        {
            result.Error = $"Parse error: {ex.Message}";
        }

        return result;
    }

    /// <summary>
    /// Reads a null-terminated string from byte array
    /// </summary>
    private string ReadNullTerminatedString(byte[] data, ref int offset)
    {
        var start = offset;
        while (offset < data.Length && data[offset] != 0x00)
        {
            offset++;
        }

        var length = offset - start;
        offset++; // Skip null terminator

        return length > 0 ? Encoding.UTF8.GetString(data, start, length) : string.Empty;
    }
}
