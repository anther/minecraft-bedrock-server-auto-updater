// Ports overview panel: cross-server port table with inline edit and swap
// Depends on globals from index.html: escapeHtml, refresh, window._serverData

let _portsServers = [];
let _portsEditServer = null;   // server name whose row is in edit mode
let _portsSwapSource = null;   // server name selected as swap source

// Restart a running server so a just-saved port takes effect. Non-blocking on
// failure: the property is already persisted, so we log rather than interrupt.
async function restartServerForPortChange(serverName) {
    try {
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error(`Auto-restart of ${serverName} failed:`, data.error || res.status);
        }
    } catch (err) {
        console.error(`Auto-restart of ${serverName} failed:`, err.message);
    }
}

function computePortConflicts(servers) {
    const owners = new Map();
    for (const s of servers) {
        for (const port of [s.serverPort, s.serverPortV6]) {
            if (!owners.has(port)) owners.set(port, []);
            owners.get(port).push(s.name);
        }
    }
    const conflicts = new Map();
    for (const [port, names] of owners) {
        if (names.length > 1) conflicts.set(port, names);
    }
    return conflicts;
}

function renderPortsPanel(servers) {
    _portsServers = [...servers].sort((a, b) => a.serverPort - b.serverPort || a.name.localeCompare(b.name));
    if (_portsEditServer) return; // don't clobber an open edit form
    rebuildPortsTable();
}

function rebuildPortsTable() {
    const container = document.getElementById('ports-container');
    if (!container) return;
    if (!_portsServers.length) {
        container.innerHTML = '<div class="empty-state">No servers found</div>';
        return;
    }

    const conflicts = computePortConflicts(_portsServers);
    let bannerHtml = '';
    if (conflicts.size) {
        const parts = [...conflicts].map(([port, names]) => {
            const uniq = [...new Set(names)].map(escapeHtml);
            return uniq.length === 1
                ? `Port ${port}: ${uniq[0]} uses it for both IPv4 and IPv6`
                : `Port ${port} used by ${uniq.join(', ')}`;
        });
        bannerHtml = `<div class="error-banner ports-conflict-banner">Port conflicts &mdash; ${parts.join(' &middot; ')}</div>`;
    }

    const rows = _portsServers.map(s => buildPortsRowHtml(s, conflicts)).join('');
    container.innerHTML = `
        ${bannerHtml}
        <table class="ports-table">
            <thead>
                <tr><th>Server</th><th>Status</th><th>Port</th><th>Port v6</th><th class="ports-actions">Actions</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="ports-footnote">Port changes to running servers are applied by restarting them automatically.</div>`;
}

function buildPortsRowHtml(s, conflicts) {
    const name = escapeHtml(s.name);
    const state = serverStatus(s);
    const v4Conflict = conflicts.has(s.serverPort) ? ' port-conflict' : '';
    const v6Conflict = conflicts.has(s.serverPortV6) ? ' port-conflict' : '';
    const isSource = _portsSwapSource === s.name;

    let actionsHtml;
    if (_portsSwapSource) {
        actionsHtml = isSource
            ? `<button class="swap-btn swap-active" onclick="cancelSwap()">Cancel swap</button>`
            : `<button class="swap-btn" onclick="performSwap('${name}')">Swap with ${escapeHtml(_portsSwapSource)}</button>`;
    } else {
        actionsHtml = `
            <button class="edit-btn" onclick="enterPortEditMode('${name}')">Edit</button>
            <button class="swap-btn" onclick="startSwap('${name}')">Swap</button>`;
    }

    return `
        <tr class="ports-row${isSource ? ' swap-source-row' : ''}" data-server="${name}">
            <td>${name}</td>
            <td><span class="status-badge ${state}"><span class="status-dot"></span>${STATUS_LABELS[state]}</span></td>
            <td class="port-cell${v4Conflict}" data-port="v4">${s.serverPort}</td>
            <td class="port-cell${v6Conflict}" data-port="v6">${s.serverPortV6}</td>
            <td class="ports-actions">${actionsHtml}</td>
        </tr>`;
}

// --- Inline edit ---

function enterPortEditMode(serverName) {
    const row = document.querySelector(`.ports-row[data-server="${CSS.escape(serverName)}"]`);
    const s = _portsServers.find(x => x.name === serverName);
    if (!row || !s) return;
    _portsEditServer = serverName;

    const name = escapeHtml(serverName);
    const inputHtml = (id, value) =>
        `<input type="number" class="edit-input port-input" id="${id}" min="1" max="65535" value="${value}" oninput="updatePortEditHints('${name}')">`;
    row.querySelector('[data-port="v4"]').innerHTML = inputHtml('port-edit-v4', s.serverPort);
    row.querySelector('[data-port="v6"]').innerHTML = inputHtml('port-edit-v6', s.serverPortV6);
    row.querySelector('.ports-actions').innerHTML = `
        <button class="edit-btn" onclick="savePortEdit('${name}')">Save</button>
        <button class="swap-btn" onclick="cancelPortEdit()">Cancel</button>`;
    updatePortEditHints(serverName);
    row.querySelector('#port-edit-v4').focus();
}

function updatePortEditHints(serverName) {
    const v4 = document.getElementById('port-edit-v4');
    const v6 = document.getElementById('port-edit-v6');
    if (!v4 || !v6) return;
    const taken = new Set();
    for (const s of _portsServers) {
        if (s.name === serverName) continue;
        taken.add(s.serverPort);
        taken.add(s.serverPortV6);
    }
    const p4 = parseInt(v4.value, 10);
    const p6 = parseInt(v6.value, 10);
    v4.classList.toggle('port-conflict', taken.has(p4) || p4 === p6);
    v6.classList.toggle('port-conflict', taken.has(p6) || p4 === p6);
}

function cancelPortEdit() {
    _portsEditServer = null;
    rebuildPortsTable();
}

async function savePortEdit(serverName) {
    const updates = {
        'server-port': document.getElementById('port-edit-v4').value,
        'server-portv6': document.getElementById('port-edit-v6').value
    };

    const postProperties = (body) => fetch(`/api/servers/${encodeURIComponent(serverName)}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    try {
        let res = await postProperties(updates);
        let data = await res.json();

        if (res.status === 409 && data.conflicts) {
            const detail = data.conflicts.map(c => `Port ${c.port} is already used by ${c.usedBy}`).join('\n');
            if (!confirm(`${detail}\n\nSave anyway?`)) return;
            res = await postProperties({ ...updates, allowConflict: true });
            data = await res.json();
        }

        if (!res.ok) {
            const msg = data.errors
                ? data.errors.map(e => `${e.key}: ${e.message}`).join('\n')
                : data.error;
            alert('Save failed:\n' + msg);
            return;
        }

        const s = _portsServers.find(x => x.name === serverName);
        _portsEditServer = null;
        if (s && s.isRunning && data.changes && Object.keys(data.changes).length) {
            await restartServerForPortChange(serverName);
        }
        await refresh();
        rebuildPortsTable();
    } catch (err) {
        alert('Save failed: ' + err.message);
    }
}

// --- Swap ---

function startSwap(serverName) {
    _portsSwapSource = serverName;
    rebuildPortsTable();
}

function cancelSwap() {
    _portsSwapSource = null;
    rebuildPortsTable();
}

async function performSwap(targetName) {
    const source = _portsSwapSource;
    if (!source || source === targetName) return;
    const a = _portsServers.find(s => s.name === source);
    const b = _portsServers.find(s => s.name === targetName);
    if (!a || !b) return;

    const runningNote = (a.isRunning || b.isRunning)
        ? '\n\nNote: running server(s) will be restarted to apply the new port.'
        : '';
    const summary = `${a.name}: ${a.serverPort}/${a.serverPortV6}  ⇄  ${b.name}: ${b.serverPort}/${b.serverPortV6}`;
    if (!confirm(`Swap ports?\n\n${summary}${runningNote}`)) return;

    try {
        const res = await fetch('/api/ports/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverA: source, serverB: targetName })
        });
        const data = await res.json();
        if (!res.ok) {
            alert('Swap failed: ' + data.error);
            return;
        }
        _portsSwapSource = null;
        if (a.isRunning) await restartServerForPortChange(a.name);
        if (b.isRunning) await restartServerForPortChange(b.name);
        await refresh();
        rebuildPortsTable();
    } catch (err) {
        alert('Swap failed: ' + err.message);
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (_portsSwapSource) cancelSwap();
        else if (_portsEditServer) cancelPortEdit();
    });
}

// Allow the pure logic to be unit-tested from Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computePortConflicts };
}
