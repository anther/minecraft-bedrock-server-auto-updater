// Server property editing and history panel logic
// Depends on globals from index.html: escapeHtml, fetchJson, refresh

const EDITABLE_FIELDS = [
    { key: 'server-name', label: 'Server Name', type: 'text', prop: 'serverName' },
    { key: 'gamemode', label: 'Gamemode', type: 'select', options: ['survival', 'creative', 'adventure'], prop: 'gamemode' },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], prop: 'difficulty' },
    { key: 'server-port', label: 'Port', type: 'number', min: 1, max: 65535, prop: 'serverPort' },
    { key: 'server-portv6', label: 'Port v6', type: 'number', min: 1, max: 65535, prop: 'serverPortV6' },
    { key: 'max-players', label: 'Max Players', type: 'number', min: 1, max: 1000, prop: 'maxPlayers' },
    { key: 'allow-cheats', label: 'Allow Cheats', type: 'toggle', prop: 'allowCheats' },
    { key: 'online-mode', label: 'Online Mode', type: 'toggle', prop: 'onlineMode' },
    { key: 'view-distance', label: 'View Distance', type: 'number', min: 5, max: 96, prop: 'viewDistance' },
    { key: 'tick-distance', label: 'Tick Distance', type: 'number', min: 4, max: 12, prop: 'tickDistance' },
    { key: 'player-idle-timeout', label: 'Idle Timeout (min)', type: 'number', min: 0, max: 9999, prop: 'playerIdleTimeout' }
];

function buildFieldInput(field, value) {
    const id = `edit-${field.key}`;
    if (field.type === 'select') {
        const opts = field.options.map(o =>
            `<option value="${o}"${String(value) === o ? ' selected' : ''}>${o}</option>`
        ).join('');
        return `<select id="${id}" class="edit-input">${opts}</select>`;
    }
    if (field.type === 'toggle') {
        const checked = String(value) === 'true' ? ' checked' : '';
        return `<label class="toggle-switch">
            <input type="checkbox" id="${id}"${checked}>
            <span class="toggle-slider"></span>
        </label>`;
    }
    // number or text
    const attrs = field.type === 'number' ? ` min="${field.min}" max="${field.max}"` : '';
    return `<input type="${field.type}" id="${id}" class="edit-input" value="${escapeHtml(String(value))}"${attrs}>`;
}

function getFieldValue(field) {
    const el = document.getElementById(`edit-${field.key}`);
    if (field.type === 'toggle') return el.checked ? 'true' : 'false';
    return el.value;
}

function enterEditMode(card, server) {
    const isOnline = !!server.query;
    const warningHtml = isOnline
        ? '<div class="running-warning">Server is running. Changes take effect after restart.</div>'
        : '';

    const fieldsHtml = EDITABLE_FIELDS.map(field => {
        const value = server.allProps[field.key] ?? '';
        return `
            <div class="edit-row">
                <label class="edit-label" for="edit-${field.key}">${field.label}</label>
                ${buildFieldInput(field, value)}
            </div>`;
    }).join('');

    card.innerHTML = `
        <div class="server-card-header">
            <h3>${escapeHtml(server.name)}</h3>
            <span class="status-badge ${isOnline ? 'online' : 'offline'}">
                <span class="status-dot"></span>
                ${isOnline ? 'Online' : 'Offline'}
            </span>
        </div>
        ${warningHtml}
        <div class="edit-form">
            ${fieldsHtml}
            <div class="edit-actions">
                <button class="btn-save" onclick="saveServerProperties('${escapeHtml(server.name)}', this.closest('.server-card'))">Save</button>
                <button class="btn-cancel" onclick="refresh()">Cancel</button>
            </div>
        </div>`;
}

async function saveServerProperties(serverName, card) {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
        updates[field.key] = getFieldValue(field);
    }

    const saveBtn = card.querySelector('.btn-save');
    const cancelBtn = card.querySelector('.btn-cancel');
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await res.json();

        if (!res.ok) {
            const msg = data.errors
                ? data.errors.map(e => `${e.key}: ${e.message}`).join('\n')
                : data.error;
            alert('Save failed:\n' + msg);
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            saveBtn.textContent = 'Save';
            return;
        }

        await refresh();
    } catch (err) {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function toggleHistoryPanel(card, serverName) {
    const existing = card.querySelector('.history-panel');
    if (existing) {
        existing.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.className = 'history-panel';
    panel.innerHTML = '<div class="empty-state">Loading history...</div>';
    card.appendChild(panel);

    try {
        const history = await fetchJson(`/api/servers/${encodeURIComponent(serverName)}/history`);
        renderHistoryPanel(panel, history, serverName);
    } catch (err) {
        panel.innerHTML = `<div class="empty-state">Failed to load history: ${escapeHtml(err.message)}</div>`;
    }
}

function renderHistoryPanel(panel, history, serverName) {
    // Only show edit entries (not undo/redo audit entries)
    const editEntries = history
        .map((entry, index) => ({ ...entry, originalIndex: index }))
        .filter(e => e.type === 'edit');

    if (!editEntries.length) {
        panel.innerHTML = '<div class="empty-state">No change history</div>';
        return;
    }

    const rows = editEntries.reverse().map(entry => {
        const time = new Date(entry.timestamp).toLocaleString();
        const changes = Object.entries(entry.changes).map(([key, val]) =>
            `<span class="history-change"><span class="history-key">${escapeHtml(key)}</span>: ${escapeHtml(val.old)} → ${escapeHtml(val.new)}</span>`
        ).join('');

        const btnClass = entry.reverted ? 'redo-btn' : 'undo-btn';
        const btnText = entry.reverted ? 'Redo' : 'Undo';
        const action = entry.reverted ? 'redo' : 'revert';

        return `
            <div class="history-entry${entry.reverted ? ' reverted' : ''}">
                <div class="history-meta">
                    <span class="history-time">${time}</span>
                    <button class="${btnClass}" onclick="handleHistoryAction('${action}', '${escapeHtml(serverName)}', ${entry.originalIndex}, this.closest('.server-card'))">
                        ${btnText}
                    </button>
                </div>
                <div class="history-changes">${changes}</div>
            </div>`;
    }).join('');

    panel.innerHTML = `<div class="history-title">Change History</div>${rows}`;
}

async function handleHistoryAction(action, serverName, index, card) {
    try {
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/history/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(`${action} failed: ${data.error}`);
            return;
        }

        // Refresh dashboard and re-open history panel
        await refresh();
        const updatedCard = document.querySelector(`.server-card[data-server="${serverName}"]`);
        if (updatedCard) {
            toggleHistoryPanel(updatedCard, serverName);
        }
    } catch (err) {
        alert(`${action} failed: ${err.message}`);
    }
}
