const http = require('http');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const { execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');
const { parseServerProperties, writeServerProperties } = require('./lib/server-properties');
const { validatePropertyUpdates } = require('./lib/validation');
const { readPropertyHistory, appendPropertyHistory, revertPropertyChange, redoPropertyChange } = require('./lib/property-history');
const { REQUIRED_SERVER_FILES, findPortConflicts, swapServerPorts } = require('./lib/ports');

const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 19100;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'configuration.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const SCRIPT_LOG = path.join(LOG_DIR, 'MinecraftScriptLog.log');
const UPDATE_HISTORY = path.join(LOG_DIR, 'MinecraftUpdateHistory.json');

const MIME_TYPES = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
};

// --- Utility Functions ---

function readJson(filePath) {
    let raw = fs.readFileSync(filePath, 'utf-8');
    // Strip UTF-8 BOM if present
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
}

function readConfig() {
    const config = readJson(CONFIG_PATH);
    const serverRoot = config.serverRoot
        ? path.resolve(PROJECT_ROOT, config.serverRoot)
        : path.resolve(PROJECT_ROOT, '..', 'TheServers');
    return {
        currentMinecraftVersion: config.currentMinecraftVersion || 'Unknown',
        serverRoot
    };
}

function readUpdateHistory() {
    if (!fs.existsSync(UPDATE_HISTORY)) return [];
    try {
        return readJson(UPDATE_HISTORY);
    } catch {
        return [];
    }
}

function readRecentLogs(count = 50) {
    if (!fs.existsSync(SCRIPT_LOG)) return { lines: [], totalLines: 0 };
    try {
        const content = fs.readFileSync(SCRIPT_LOG, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        return {
            lines: lines.slice(-count),
            totalLines: lines.length
        };
    } catch {
        return { lines: [], totalLines: 0 };
    }
}

// Tail the last `count` non-blank lines of a log file. Returns null if the file
// doesn't exist so callers can distinguish "never captured" from "empty".
function tailLogFile(filePath, count) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        let updatedAt = null;
        try { updatedAt = fs.statSync(filePath).mtime.toISOString(); } catch { /* ignore */ }
        return {
            lines: lines.slice(-count),
            totalLines: lines.length,
            updatedAt
        };
    } catch {
        return null;
    }
}

// Read a server's captured console output. The redirected stdout/stderr files are
// written by buildRestartScript() when a server is (re)started from the dashboard,
// so `available` is false for servers that were never launched through it.
function readServerConsole(serverDir, count = 200) {
    const logDir = path.join(serverDir, 'console-logs');
    const stdout = tailLogFile(path.join(logDir, 'latest.log'), count);
    const stderr = tailLogFile(path.join(logDir, 'latest.err.log'), count);
    const empty = { lines: [], totalLines: 0, updatedAt: null };
    return {
        available: !!(stdout || stderr),
        stdout: stdout || empty,
        stderr: stderr || empty
    };
}

function getRunningServerPaths() {
    try {
        const psCommand = 'Get-CimInstance Win32_Process -Filter "name=\'bedrock_server.exe\'" | ForEach-Object { $_.ExecutablePath } | Where-Object { $_ }';
        const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
            encoding: 'utf-8',
            timeout: 10000,
            windowsHide: true
        });
        return output.trim().split(/\r?\n/).map(p => p.trim()).filter(Boolean);
    } catch (err) {
        console.error('Failed to query running servers:', err.message);
        return [];
    }
}

function isServerRunning(serverDir, runningPaths) {
    const normalized = path.resolve(serverDir).toLowerCase() + path.sep;
    return runningPaths.some(p => path.resolve(p).toLowerCase().startsWith(normalized));
}

// Build a PowerShell script that force-stops any bedrock_server.exe running under
// `root`, waits for it to exit, rotates the console logs, then relaunches it hidden.
// This mirrors the Start()/Stop() logic in ../MinecraftServer.ps1 so a restart from
// the dashboard behaves identically to one driven by the maintenance script.
function buildRestartScript(root) {
    // Single-quote escaping: PowerShell literal strings only treat '' specially, so
    // doubling single quotes makes an arbitrary path injection-safe.
    const safeRoot = root.replace(/'/g, "''");
    return `
$ErrorActionPreference = 'Stop'
$root = '${safeRoot}'
$exe = Join-Path $root 'bedrock_server.exe'
$prefix = $root.ToLower().TrimEnd('\\') + '\\'
$mine = {
    Get-CimInstance Win32_Process -Filter "name='bedrock_server.exe'" |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLower().StartsWith($prefix) }
}
foreach ($p in & $mine) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
for ($i = 0; $i -lt 20; $i++) {
    if (-not (& $mine)) { break }
    Start-Sleep -Milliseconds 300
}
$logDir = Join-Path $root 'console-logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$latestOut = Join-Path $logDir 'latest.log'
$prevOut   = Join-Path $logDir 'previous.log'
$latestErr = Join-Path $logDir 'latest.err.log'
$prevErr   = Join-Path $logDir 'previous.err.log'
if (Test-Path $latestOut) { Move-Item -Path $latestOut -Destination $prevOut -Force }
if (Test-Path $latestErr) { Move-Item -Path $latestErr -Destination $prevErr -Force }
Start-Process -FilePath $exe -WorkingDirectory $root -WindowStyle Hidden \`
    -RedirectStandardOutput $latestOut -RedirectStandardError $latestErr
`;
}

function restartServerAt(serverDir) {
    // stdio: 'ignore' is essential, not cosmetic. PowerShell's Start-Process with
    // -RedirectStandardOutput launches the child with inherited handles, so the new
    // bedrock_server.exe inherits our stdout/stderr pipes and holds them open for its
    // whole lifetime. With piped stdio, execFileSync would then block on pipe EOF until
    // the timeout (falsely reporting failure, and risking killing PowerShell mid-work).
    // Ignoring stdio leaves no pipes to inherit, so this returns as soon as PowerShell
    // exits (~1-2s). A non-zero exit still throws, which the caller surfaces.
    execFileSync('powershell.exe', ['-NoProfile', '-Command', buildRestartScript(serverDir)], {
        stdio: 'ignore',
        timeout: 30000,
        windowsHide: true
    });
}

function getDirSizeBytes(dirPath) {
    let total = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                total += getDirSizeBytes(fullPath);
            } else {
                try { total += fs.statSync(fullPath).size; } catch { /* skip */ }
            }
        }
    } catch { /* skip */ }
    return total;
}

function getWorldStats(serverDir, levelName) {
    const worldDir = path.join(serverDir, 'worlds', levelName);
    if (!fs.existsSync(worldDir)) return { sizeMB: 0, lastSave: null };

    const sizeMB = Math.round(getDirSizeBytes(worldDir) / (1024 * 1024) * 100) / 100;

    let lastSave = null;
    const levelDat = path.join(worldDir, 'level.dat');
    try {
        lastSave = fs.statSync(levelDat).mtime.toISOString();
    } catch { /* ignore */ }

    return { sizeMB, lastSave };
}

function discoverServers(serverRoot) {
    if (!fs.existsSync(serverRoot)) return [];

    const runningPaths = getRunningServerPaths();
    const entries = fs.readdirSync(serverRoot, { withFileTypes: true });
    const servers = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const serverDir = path.join(serverRoot, entry.name);

        const hasAllFiles = REQUIRED_SERVER_FILES.every(f =>
            fs.existsSync(path.join(serverDir, f))
        );
        if (!hasAllFiles) continue;

        // Read version
        let version = 'Unknown';
        try {
            const versionData = readJson(path.join(serverDir, 'currentVersion.json'));
            version = versionData.Version || 'Unknown';
        } catch { /* ignore */ }

        // Read properties
        const props = parseServerProperties(path.join(serverDir, 'server.properties'));

        const levelName = props['level-name'] || 'Bedrock level';
        const worldStats = getWorldStats(serverDir, levelName);

        // Check for banner image
        let bannerExt = null;
        for (const ext of ['.png', '.jpg']) {
            if (fs.existsSync(path.join(serverDir, `banner${ext}`))) {
                bannerExt = ext;
                break;
            }
        }

        servers.push({
            name: entry.name,
            path: serverDir,
            version,
            serverName: props['server-name'] || entry.name,
            gamemode: props['gamemode'] || 'Unknown',
            difficulty: props['difficulty'] || 'Unknown',
            serverPort: parseInt(props['server-port'], 10) || 19132,
            serverPortV6: parseInt(props['server-portv6'], 10) || 19133,
            maxPlayers: parseInt(props['max-players'], 10) || 10,
            levelName,
            isRunning: isServerRunning(serverDir, runningPaths),
            allProps: props,
            worldSizeMB: worldStats.sizeMB,
            lastSave: worldStats.lastSave,
            viewDistance: parseInt(props['view-distance'], 10) || 32,
            tickDistance: parseInt(props['tick-distance'], 10) || 4,
            allowCheats: props['allow-cheats'] || 'false',
            onlineMode: props['online-mode'] || 'true',
            defaultPermission: props['default-player-permission-level'] || 'member',
            allowList: props['allow-list'] || 'false',
            bannerExt
        });
    }

    return servers;
}

// --- Bedrock Server Query (RakNet UDP Ping) ---

const RAKNET_MAGIC = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');

function queryBedrockServer(address, port, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        let resolved = false;

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                socket.close();
                resolve(null);
            }
        }, timeoutMs);

        socket.on('message', (msg) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            socket.close();

            if (msg[0] !== 0x1c || msg.length < 35) {
                resolve(null);
                return;
            }

            const strLen = (msg[33] << 8) + msg[34];
            const serverInfo = msg.toString('utf8', 35, 35 + strLen);
            const fields = serverInfo.split(';');

            resolve({
                edition: fields[0] || '',
                motd: fields[1] || '',
                protocol: parseInt(fields[2], 10) || 0,
                version: fields[3] || '',
                onlinePlayers: parseInt(fields[4], 10) || 0,
                maxPlayers: parseInt(fields[5], 10) || 0,
                worldName: fields[7] || '',
                gamemode: fields[8] || ''
            });
        });

        socket.on('error', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                socket.close();
                resolve(null);
            }
        });

        // Build Unconnected Ping packet
        const ping = Buffer.alloc(33);
        ping[0] = 0x01;
        const now = BigInt(Date.now());
        ping.writeBigInt64BE(now, 1);
        RAKNET_MAGIC.copy(ping, 9);
        ping.writeBigInt64BE(BigInt(2), 25); // client GUID
        socket.send(ping, port, address);
    });
}

async function queryAllServers(servers) {
    const queries = servers.map(s =>
        queryBedrockServer('127.0.0.1', s.serverPort)
            .then(result => ({ name: s.name, query: result }))
    );
    const results = await Promise.all(queries);
    const map = {};
    for (const r of results) {
        map[r.name] = r.query;
    }
    return map;
}

// --- Gather All Dashboard Data ---

async function gatherAllData() {
    const config = readConfig();
    const servers = discoverServers(config.serverRoot);
    const queryMap = await queryAllServers(servers);
    for (const s of servers) s.query = queryMap[s.name] || null;
    return {
        config: { currentMinecraftVersion: config.currentMinecraftVersion },
        servers: { servers },
        history: readUpdateHistory(),
        logs: readRecentLogs(50)
    };
}

// --- Request Helpers ---

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch (err) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function resolveServerDir(folderName) {
    const config = readConfig();
    // Prevent path traversal
    const safeName = path.basename(folderName);
    const serverDir = path.join(config.serverRoot, safeName);
    const hasAllFiles = REQUIRED_SERVER_FILES.every(f =>
        fs.existsSync(path.join(serverDir, f))
    );
    if (!hasAllFiles) return null;
    return serverDir;
}

function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
        res.end(content);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

// --- HTTP Server ---

function sendJson(res, data, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    });
    res.end(body);
}

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    try {
        switch (url.pathname) {
            case '/': {
                const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                break;
            }
            case '/favicon.ico': {
                res.writeHead(204);
                res.end();
                break;
            }
            case '/api/config': {
                sendJson(res, readConfig());
                break;
            }
            case '/api/history': {
                sendJson(res, readUpdateHistory());
                break;
            }
            case '/api/logs': {
                sendJson(res, readRecentLogs(50));
                break;
            }
            case '/api/servers': {
                const config = readConfig();
                const servers = discoverServers(config.serverRoot);
                const queryMap = await queryAllServers(servers);
                for (const s of servers) {
                    s.query = queryMap[s.name] || null;
                }
                sendJson(res, { servers });
                break;
            }
            case '/api/restart-all': {
                if (req.method !== 'POST') {
                    sendJson(res, { error: 'Method not allowed' }, 405);
                    break;
                }
                const config = readConfig();
                const servers = discoverServers(config.serverRoot);
                const results = [];
                for (const s of servers) {
                    try {
                        restartServerAt(s.path);
                        results.push({ name: s.name, ok: true });
                    } catch (err) {
                        results.push({ name: s.name, ok: false, error: err.message });
                    }
                }
                const failed = results.filter(r => !r.ok);
                sendJson(res, {
                    message: failed.length
                        ? `Restarted ${results.length - failed.length}/${results.length} servers`
                        : `Restarted all ${results.length} servers`,
                    results
                }, failed.length ? 207 : 200);
                broadcastUpdate();
                break;
            }
            case '/api/ports/swap': {
                if (req.method !== 'POST') {
                    sendJson(res, { error: 'Method not allowed' }, 405);
                    break;
                }
                const { serverA, serverB } = await parseRequestBody(req);
                if (!serverA || !serverB || serverA === serverB) {
                    sendJson(res, { error: 'Two different server names required' }, 400);
                    break;
                }
                const dirA = resolveServerDir(serverA);
                const dirB = resolveServerDir(serverB);
                if (!dirA || !dirB) {
                    sendJson(res, { error: `Server not found: ${!dirA ? serverA : serverB}` }, 404);
                    break;
                }

                let changesA, changesB;
                try {
                    ({ changesA, changesB } = swapServerPorts(dirA, dirB));
                } catch (err) {
                    sendJson(res, { error: `Swap failed, no changes applied: ${err.message}` }, 500);
                    break;
                }

                if (!Object.keys(changesA).length && !Object.keys(changesB).length) {
                    sendJson(res, { message: 'No changes detected' });
                    break;
                }

                if (Object.keys(changesA).length) appendPropertyHistory(dirA, changesA);
                if (Object.keys(changesB).length) appendPropertyHistory(dirB, changesB);
                sendJson(res, { message: 'Ports swapped', changes: { [serverA]: changesA, [serverB]: changesB } });
                broadcastUpdate();
                break;
            }
            default: {
                // Static file serving for /js/* paths
                if (url.pathname.startsWith('/js/')) {
                    const safePath = path.basename(url.pathname);
                    serveStaticFile(res, path.join(__dirname, 'js', safePath));
                    break;
                }

                // Dynamic server API routes: /api/servers/{folderName}/...
                const serverApiMatch = url.pathname.match(/^\/api\/servers\/([^/]+)\/(.+)$/);
                if (serverApiMatch) {
                    const folderName = decodeURIComponent(serverApiMatch[1]);
                    const action = serverApiMatch[2];
                    const serverDir = resolveServerDir(folderName);

                    if (!serverDir) {
                        sendJson(res, { error: `Server not found: ${folderName}` }, 404);
                        break;
                    }

                    if (action === 'banner' && req.method === 'GET') {
                        let bannerPath = null;
                        for (const ext of ['.png', '.jpg']) {
                            const candidate = path.join(serverDir, `banner${ext}`);
                            if (fs.existsSync(candidate)) { bannerPath = candidate; break; }
                        }
                        if (!bannerPath) {
                            res.writeHead(404);
                            res.end('No banner');
                            break;
                        }
                        const mime = bannerPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
                        const img = fs.readFileSync(bannerPath);
                        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=300' });
                        res.end(img);
                        break;
                    }

                    if (action === 'properties' && req.method === 'POST') {
                        const { allowConflict, ...propUpdates } = await parseRequestBody(req);
                        const { valid, errors } = validatePropertyUpdates(propUpdates);
                        if (!valid) {
                            sendJson(res, { error: 'Validation failed', errors }, 400);
                            break;
                        }

                        // Read current values for history
                        const propsPath = path.join(serverDir, 'server.properties');
                        const currentProps = parseServerProperties(propsPath);

                        if (allowConflict !== true) {
                            const conflicts = findPortConflicts(propUpdates, folderName, currentProps, readConfig().serverRoot);
                            if (conflicts.length) {
                                sendJson(res, { error: 'Port conflict', conflicts }, 409);
                                break;
                            }
                        }
                        const changes = {};
                        for (const [key, newVal] of Object.entries(propUpdates)) {
                            const oldVal = currentProps[key] || '';
                            if (String(newVal) !== String(oldVal)) {
                                changes[key] = { old: oldVal, new: String(newVal) };
                            }
                        }

                        if (Object.keys(changes).length === 0) {
                            sendJson(res, { message: 'No changes detected' });
                            break;
                        }

                        // Convert all values to strings for writing
                        const updates = {};
                        for (const [key, val] of Object.entries(propUpdates)) {
                            updates[key] = String(val);
                        }

                        writeServerProperties(propsPath, updates);
                        appendPropertyHistory(serverDir, changes);
                        sendJson(res, { message: 'Properties updated', changes });
                        broadcastUpdate();
                        break;
                    }

                    if (action === 'restart' && req.method === 'POST') {
                        try {
                            restartServerAt(serverDir);
                        } catch (err) {
                            sendJson(res, { error: `Restart failed: ${err.message}` }, 500);
                            break;
                        }
                        sendJson(res, { message: 'Server restarting' });
                        broadcastUpdate();
                        break;
                    }

                    if (action === 'console' && req.method === 'GET') {
                        const count = Math.min(parseInt(url.searchParams.get('lines'), 10) || 200, 1000);
                        sendJson(res, readServerConsole(serverDir, count));
                        break;
                    }

                    if (action === 'history' && req.method === 'GET') {
                        sendJson(res, readPropertyHistory(serverDir));
                        break;
                    }

                    if (action === 'history/revert' && req.method === 'POST') {
                        const body = await parseRequestBody(req);
                        const index = parseInt(body.index, 10);
                        if (isNaN(index)) {
                            sendJson(res, { error: 'Missing or invalid index' }, 400);
                            break;
                        }
                        revertPropertyChange(serverDir, index);
                        sendJson(res, { message: 'Change reverted' });
                        broadcastUpdate();
                        break;
                    }

                    if (action === 'history/redo' && req.method === 'POST') {
                        const body = await parseRequestBody(req);
                        const index = parseInt(body.index, 10);
                        if (isNaN(index)) {
                            sendJson(res, { error: 'Missing or invalid index' }, 400);
                            break;
                        }
                        redoPropertyChange(serverDir, index);
                        sendJson(res, { message: 'Change re-applied' });
                        broadcastUpdate();
                        break;
                    }

                    sendJson(res, { error: 'Unknown action' }, 404);
                    break;
                }

                res.writeHead(404);
                res.end('Not found');
            }
        }
    } catch (err) {
        console.error(`Error handling ${url.pathname}:`, err.message);
        sendJson(res, { error: err.message }, 500);
    }
}

const server = http.createServer(handleRequest);

// --- WebSocket Server ---

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send initial data snapshot
    try {
        const data = await gatherAllData();
        ws.send(JSON.stringify({ type: 'init', ...data }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'request-refresh') {
                gatherAllData().then(data => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'update', ...data }));
                    }
                }).catch(() => {});
            }
        } catch { /* ignore malformed messages */ }
    });
});

async function broadcastUpdate() {
    if (wss.clients.size === 0) return;
    try {
        const data = await gatherAllData();
        const msg = JSON.stringify({ type: 'update', ...data });
        for (const client of wss.clients) {
            if (client.readyState === client.OPEN) client.send(msg);
        }
    } catch (err) {
        console.error('Broadcast error:', err.message);
    }
}

setInterval(broadcastUpdate, 30000);

// Heartbeat: detect dead connections
setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
    }
}, 30000);

// Live reload via WebSocket
fs.watch(__dirname, { recursive: false }, (_eventType, filename) => {
    if (!filename || filename === 'server.js') return;
    const msg = JSON.stringify({ type: 'live-reload', filename });
    for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(msg);
    }
});

server.listen(PORT, () => {
    console.log(`Minecraft Server Dashboard running at http://localhost:${PORT}`);
});
