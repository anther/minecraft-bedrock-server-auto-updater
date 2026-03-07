const http = require('http');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const { execFileSync } = require('child_process');
const { parseServerProperties, writeServerProperties } = require('./lib/server-properties');
const { validatePropertyUpdates } = require('./lib/validation');
const { readPropertyHistory, appendPropertyHistory, revertPropertyChange, redoPropertyChange } = require('./lib/property-history');

const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 19100;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'configuration.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const SCRIPT_LOG = path.join(LOG_DIR, 'MinecraftScriptLog.log');
const UPDATE_HISTORY = path.join(LOG_DIR, 'MinecraftUpdateHistory.json');
const REQUIRED_SERVER_FILES = ['bedrock_server.exe', 'server.properties', 'permissions.json', 'allowlist.json'];

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
            allowList: props['allow-list'] || 'false'
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

// --- Live Reload (SSE) ---

const liveReloadClients = new Set();

fs.watch(__dirname, { recursive: false }, (_eventType, filename) => {
    if (!filename || filename === 'server.js') return;
    for (const res of liveReloadClients) {
        res.write(`data: ${filename}\n\n`);
    }
});

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
            case '/api/live-reload': {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                res.write('data: connected\n\n');
                liveReloadClients.add(res);
                req.on('close', () => liveReloadClients.delete(res));
                return;
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

                    if (action === 'properties' && req.method === 'POST') {
                        const body = await parseRequestBody(req);
                        const { valid, errors } = validatePropertyUpdates(body);
                        if (!valid) {
                            sendJson(res, { error: 'Validation failed', errors }, 400);
                            break;
                        }

                        // Read current values for history
                        const propsPath = path.join(serverDir, 'server.properties');
                        const currentProps = parseServerProperties(propsPath);
                        const changes = {};
                        for (const [key, newVal] of Object.entries(body)) {
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
                        for (const [key, val] of Object.entries(body)) {
                            updates[key] = String(val);
                        }

                        writeServerProperties(propsPath, updates);
                        appendPropertyHistory(serverDir, changes);
                        sendJson(res, { message: 'Properties updated', changes });
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

server.listen(PORT, () => {
    console.log(`Minecraft Server Dashboard running at http://localhost:${PORT}`);
});
