// Unit tests for the ports feature. Zero dependencies, runs on Node 14+:
//   npm test   (or: node test/ports.test.js)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { collectPortMap, findPortConflicts, swapServerPorts } = require('../lib/ports');
const { computePortConflicts } = require('../js/ports-panel');
const { parseServerProperties } = require('../lib/server-properties');

// --- Minimal test harness (node:test needs Node 18+; this repo runs on 14) ---

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// --- Fixture helpers ---

let root;

function makeServer(name, props, opts = {}) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
        '# Bedrock server configuration',
        `server-name=${name}`,
        ...Object.entries(props).map(([k, v]) => `${k}=${v}`),
        'max-players=10'
    ];
    fs.writeFileSync(path.join(dir, 'server.properties'), lines.join('\r\n') + '\r\n', 'utf-8');
    for (const f of ['bedrock_server.exe', 'permissions.json', 'allowlist.json']) {
        if (f !== opts.missingFile) fs.writeFileSync(path.join(dir, f), '', 'utf-8');
    }
    return dir;
}

const propsOf = (dir) => parseServerProperties(path.join(dir, 'server.properties'));
const rawOf = (dir) => fs.readFileSync(path.join(dir, 'server.properties'), 'utf-8');

// --- collectPortMap ---

test('collectPortMap: collects ports from valid server directories', () => {
    makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    assert.deepStrictEqual(collectPortMap(root), {
        Alpha: { serverPort: 19132, serverPortV6: 19133 },
        Beta: { serverPort: 19134, serverPortV6: 19135 }
    });
});

test('collectPortMap: skips directories missing required server files', () => {
    makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('NotAServer', { 'server-port': 19140 }, { missingFile: 'bedrock_server.exe' });
    assert.deepStrictEqual(Object.keys(collectPortMap(root)), ['Alpha']);
});

test('collectPortMap: excludes the named server', () => {
    makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    assert.deepStrictEqual(Object.keys(collectPortMap(root, 'Alpha')), ['Beta']);
});

test('collectPortMap: applies Bedrock defaults when port keys are absent', () => {
    makeServer('Alpha', {});
    assert.deepStrictEqual(collectPortMap(root).Alpha, { serverPort: 19132, serverPortV6: 19133 });
});

test('collectPortMap: returns empty map for a missing root', () => {
    assert.deepStrictEqual(collectPortMap(path.join(root, 'nope')), {});
});

// --- findPortConflicts ---

test('findPortConflicts: flags a change onto another server\'s IPv4 port', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    const conflicts = findPortConflicts({ 'server-port': '19134' }, 'Alpha', propsOf(a), root);
    assert.deepStrictEqual(conflicts, [{ port: 19134, usedBy: 'Beta' }]);
});

test('findPortConflicts: flags a change onto another server\'s IPv6 port', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    const conflicts = findPortConflicts({ 'server-portv6': '19135' }, 'Alpha', propsOf(a), root);
    assert.deepStrictEqual(conflicts, [{ port: 19135, usedBy: 'Beta' }]);
});

test('findPortConflicts: unchanged ports never conflict, even when a duplicate already exists', () => {
    // Alpha and Beta already share 19132 (a deliberately overridden state).
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19132, 'server-portv6': 19135 });
    // Re-sending the same ports (as the card edit form does) must not block.
    const conflicts = findPortConflicts(
        { 'server-port': '19132', 'server-portv6': '19133' }, 'Alpha', propsOf(a), root);
    assert.deepStrictEqual(conflicts, []);
});

test('findPortConflicts: no port keys in the update means no conflicts', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19132, 'server-portv6': 19135 });
    assert.deepStrictEqual(findPortConflicts({ gamemode: 'creative' }, 'Alpha', propsOf(a), root), []);
});

test('findPortConflicts: flags IPv4 changed to equal the server\'s own IPv6 port', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    const conflicts = findPortConflicts({ 'server-port': '19133' }, 'Alpha', propsOf(a), root);
    assert.deepStrictEqual(conflicts, [{ port: 19133, usedBy: 'Alpha (IPv4 and IPv6 must differ)' }]);
});

test('findPortConflicts: reports every owner of a contested port', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    makeServer('Gamma', { 'server-port': 19134, 'server-portv6': 19137 });
    const conflicts = findPortConflicts({ 'server-port': '19134' }, 'Alpha', propsOf(a), root);
    assert.deepStrictEqual(conflicts.map(c => c.usedBy).sort(), ['Beta', 'Gamma']);
});

// --- swapServerPorts ---

test('swapServerPorts: exchanges both port keys between the two files', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    const b = makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });

    const { changesA, changesB } = swapServerPorts(a, b);

    assert.deepStrictEqual(changesA, {
        'server-port': { old: '19132', new: '19134' },
        'server-portv6': { old: '19133', new: '19135' }
    });
    assert.deepStrictEqual(changesB, {
        'server-port': { old: '19134', new: '19132' },
        'server-portv6': { old: '19135', new: '19133' }
    });

    assert.strictEqual(propsOf(a)['server-port'], '19134');
    assert.strictEqual(propsOf(a)['server-portv6'], '19135');
    assert.strictEqual(propsOf(b)['server-port'], '19132');
    assert.strictEqual(propsOf(b)['server-portv6'], '19133');
});

test('swapServerPorts: preserves comments, other keys, and CRLF line endings', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    const b = makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });

    swapServerPorts(a, b);

    const raw = rawOf(a);
    assert.ok(raw.indexOf('# Bedrock server configuration\r\n') !== -1);
    assert.ok(raw.indexOf('server-name=Alpha\r\n') !== -1);
    assert.ok(raw.indexOf('max-players=10') !== -1);
    assert.ok(!/(^|[^\r])\n/.test(raw), 'expected only CRLF line endings');
});

test('swapServerPorts: is a no-op when both servers already have identical ports', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    const b = makeServer('Beta', { 'server-port': 19132, 'server-portv6': 19133 });
    const beforeA = rawOf(a);

    const { changesA, changesB } = swapServerPorts(a, b);

    assert.deepStrictEqual(changesA, {});
    assert.deepStrictEqual(changesB, {});
    assert.strictEqual(rawOf(a), beforeA);
});

test('swapServerPorts: rolls back the first file when writing the second fails', () => {
    const a = makeServer('Alpha', { 'server-port': 19132, 'server-portv6': 19133 });
    const b = makeServer('Beta', { 'server-port': 19134, 'server-portv6': 19135 });
    const beforeA = rawOf(a);

    const propsB = path.join(b, 'server.properties');
    fs.chmodSync(propsB, 0o444); // read-only forces the second write to fail
    try {
        assert.throws(() => swapServerPorts(a, b));
    } finally {
        fs.chmodSync(propsB, 0o666);
    }

    assert.strictEqual(rawOf(a), beforeA, 'first file must be restored after a failed swap');
});

// --- computePortConflicts (frontend) ---

const server = (name, v4, v6) => ({ name, serverPort: v4, serverPortV6: v6 });

test('computePortConflicts: empty when all ports are unique', () => {
    const conflicts = computePortConflicts([
        server('Alpha', 19132, 19133),
        server('Beta', 19134, 19135)
    ]);
    assert.strictEqual(conflicts.size, 0);
});

test('computePortConflicts: detects a port shared between two servers', () => {
    const conflicts = computePortConflicts([
        server('Alpha', 19132, 19133),
        server('Beta', 19132, 19135)
    ]);
    assert.deepStrictEqual([...conflicts.keys()], [19132]);
    assert.deepStrictEqual(conflicts.get(19132).sort(), ['Alpha', 'Beta']);
});

test('computePortConflicts: detects one server using the same port for IPv4 and IPv6', () => {
    const conflicts = computePortConflicts([server('Alpha', 19132, 19132)]);
    assert.deepStrictEqual([...conflicts.keys()], [19132]);
    assert.deepStrictEqual(conflicts.get(19132), ['Alpha', 'Alpha']);
});

test('computePortConflicts: detects a cross conflict on IPv6 ports', () => {
    const conflicts = computePortConflicts([
        server('Alpha', 19132, 19133),
        server('Beta', 19134, 19133)
    ]);
    assert.deepStrictEqual([...conflicts.keys()], [19133]);
});

// --- Runner ---

let passed = 0;
const failures = [];
for (const t of tests) {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ports-test-'));
    try {
        t.fn();
        passed++;
        console.log(`  ok - ${t.name}`);
    } catch (err) {
        failures.push({ name: t.name, err });
        console.error(`  FAIL - ${t.name}`);
        console.error(`    ${String(err.message).split('\n').join('\n    ')}`);
    } finally {
        try { fs.rmdirSync(root, { recursive: true }); } catch { /* ignore */ }
    }
}

console.log(`\n${passed}/${tests.length} tests passed`);
if (failures.length) process.exit(1);
