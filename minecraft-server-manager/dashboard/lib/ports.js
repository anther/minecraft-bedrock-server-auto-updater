const fs = require('fs');
const path = require('path');
const { parseServerProperties, writeServerProperties } = require('./server-properties');

const REQUIRED_SERVER_FILES = ['bedrock_server.exe', 'server.properties', 'permissions.json', 'allowlist.json'];
const DEFAULT_PORT_V4 = 19132;
const DEFAULT_PORT_V6 = 19133;

function collectPortMap(serverRoot, excludeName) {
    const portMap = {};
    if (!fs.existsSync(serverRoot)) return portMap;
    for (const entry of fs.readdirSync(serverRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === excludeName) continue;
        const serverDir = path.join(serverRoot, entry.name);
        const hasAllFiles = REQUIRED_SERVER_FILES.every(f =>
            fs.existsSync(path.join(serverDir, f))
        );
        if (!hasAllFiles) continue;
        const props = parseServerProperties(path.join(serverDir, 'server.properties'));
        portMap[entry.name] = {
            serverPort: parseInt(props['server-port'], 10) || DEFAULT_PORT_V4,
            serverPortV6: parseInt(props['server-portv6'], 10) || DEFAULT_PORT_V6
        };
    }
    return portMap;
}

function findPortConflicts(propUpdates, folderName, currentProps, serverRoot) {
    // Only ports that actually change are checked, so a pre-existing
    // (deliberately overridden) conflict never blocks unrelated edits.
    const changedPorts = [];
    const effective = {};
    for (const [key, fallback] of [['server-port', DEFAULT_PORT_V4], ['server-portv6', DEFAULT_PORT_V6]]) {
        const current = parseInt(currentProps[key], 10) || fallback;
        const requested = key in propUpdates ? parseInt(propUpdates[key], 10) : current;
        effective[key] = requested;
        if (requested !== current) changedPorts.push(requested);
    }
    if (!changedPorts.length) return [];

    const conflicts = [];
    if (effective['server-port'] === effective['server-portv6']) {
        conflicts.push({ port: effective['server-port'], usedBy: `${folderName} (IPv4 and IPv6 must differ)` });
    }
    const portMap = collectPortMap(serverRoot, folderName);
    for (const port of changedPorts) {
        for (const [name, ports] of Object.entries(portMap)) {
            if (port === ports.serverPort || port === ports.serverPortV6) {
                conflicts.push({ port, usedBy: name });
            }
        }
    }
    return conflicts;
}

// Exchanges server-port/server-portv6 between two server directories.
// Rolls back the first file if writing the second fails, then rethrows.
function swapServerPorts(dirA, dirB) {
    const pathA = path.join(dirA, 'server.properties');
    const pathB = path.join(dirB, 'server.properties');
    const rawA = fs.readFileSync(pathA, 'utf-8');
    const propsA = parseServerProperties(pathA);
    const propsB = parseServerProperties(pathB);

    const portsOf = (props) => ({
        'server-port': String(parseInt(props['server-port'], 10) || DEFAULT_PORT_V4),
        'server-portv6': String(parseInt(props['server-portv6'], 10) || DEFAULT_PORT_V6)
    });
    const currentA = portsOf(propsA);
    const currentB = portsOf(propsB);
    const buildChanges = (from, to) => {
        const changes = {};
        for (const key of Object.keys(from)) {
            if (from[key] !== to[key]) changes[key] = { old: from[key], new: to[key] };
        }
        return changes;
    };
    const changesA = buildChanges(currentA, currentB);
    const changesB = buildChanges(currentB, currentA);

    if (!Object.keys(changesA).length && !Object.keys(changesB).length) {
        return { changesA, changesB };
    }

    writeServerProperties(pathA, currentB);
    try {
        writeServerProperties(pathB, currentA);
    } catch (err) {
        fs.writeFileSync(pathA, rawA, 'utf-8');
        throw err;
    }

    return { changesA, changesB };
}

module.exports = { REQUIRED_SERVER_FILES, collectPortMap, findPortConflicts, swapServerPorts };
