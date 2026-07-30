// Per-server console output viewer.
// Reads console-logs/latest.log (stdout) and latest.err.log (stderr), which are
// captured only when a server is (re)started from the dashboard. Depends on
// globals from index.html: escapeHtml, fetchJson, formatRelativeTime.

const CONSOLE_POLL_MS = 3000;
const CONSOLE_TAIL_LINES = 200;

// Toggle the console panel for a card open/closed. Mirrors toggleHistoryPanel:
// the panel is appended to the card and survives periodic (non-forced) refreshes,
// so the poll below keeps it live until the user closes it or refresh() rebuilds
// the card from scratch (which orphans the node — the poll's isConnected guard
// then stops the timer).
async function toggleConsolePanel(card, serverName) {
    const existing = card.querySelector('.console-panel');
    const btn = card.querySelector('.console-btn');

    if (existing) {
        stopConsolePolling(existing);
        existing.remove();
        if (btn) btn.classList.remove('active');
        return;
    }

    const panel = document.createElement('div');
    panel.className = 'console-panel';
    panel.innerHTML = '<div class="empty-state">Loading console...</div>';
    card.appendChild(panel);
    if (btn) btn.classList.add('active');

    await loadConsole(panel, serverName, true);

    const timer = setInterval(() => {
        if (!panel.isConnected) { clearInterval(timer); return; }
        loadConsole(panel, serverName, false);
    }, CONSOLE_POLL_MS);
    panel._consoleTimer = timer;
}

function stopConsolePolling(panel) {
    if (panel && panel._consoleTimer) {
        clearInterval(panel._consoleTimer);
        panel._consoleTimer = null;
    }
}

// Manual "Refresh" button — always re-render even if the user scrolled up.
function reloadConsole(panel, serverName) {
    loadConsole(panel, serverName, true);
}

async function loadConsole(panel, serverName, force) {
    let data;
    try {
        data = await fetchJson(`/api/servers/${encodeURIComponent(serverName)}/console?lines=${CONSOLE_TAIL_LINES}`);
    } catch (err) {
        // Only surface fetch errors on the initial/manual load; a transient poll
        // failure shouldn't blow away visible output.
        if (force) panel.innerHTML = `<div class="empty-state">Failed to load console: ${escapeHtml(err.message)}</div>`;
        return;
    }
    renderConsolePanel(panel, serverName, data, force);
}

function renderConsolePanel(panel, serverName, data, force) {
    if (!data.available) {
        stopConsolePolling(panel);
        panel.innerHTML = `
            <div class="console-panel-head">
                <span class="console-panel-title">Console</span>
                <button class="console-refresh-btn" onclick="reloadConsole(this.closest('.console-panel'), '${escapeHtml(serverName)}')">Refresh</button>
            </div>
            <div class="empty-state">No console output captured yet.<br>Restart this server from the dashboard to start capturing its output.</div>`;
        return;
    }

    const json = JSON.stringify(data);
    if (json === panel._lastConsoleJson && !force) return;

    // Preserve the user's scroll position: if they've scrolled up to read older
    // output, skip periodic rebuilds (matches the main log viewer's behaviour).
    const prevOutput = panel.querySelector('.console-output');
    const wasAtBottom = !prevOutput ||
        prevOutput.scrollTop + prevOutput.clientHeight >= prevOutput.scrollHeight - 12;
    if (prevOutput && !wasAtBottom && !force) {
        panel._lastConsoleJson = json;
        return;
    }

    panel._lastConsoleJson = json;

    const stdoutLines = data.stdout.lines || [];
    const stderrLines = data.stderr.lines || [];

    let body = stdoutLines.map(l => `<div class="log-line">${escapeHtml(l)}</div>`).join('');
    if (stderrLines.length) {
        body += '<div class="console-divider">stderr</div>' +
            stderrLines.map(l => `<div class="log-line stderr">${escapeHtml(l)}</div>`).join('');
    }
    if (!body) body = '<div class="empty-state">Console log is empty.</div>';

    const shown = stdoutLines.length;
    const total = data.stdout.totalLines;
    const countText = total > shown
        ? `Showing last ${shown} of ${total} lines`
        : `${shown} line${shown === 1 ? '' : 's'}`;
    const updated = data.stdout.updatedAt ? formatRelativeTime(data.stdout.updatedAt) : '--';

    panel.innerHTML = `
        <div class="console-panel-head">
            <span class="console-panel-title">Console &mdash; latest.log</span>
            <button class="console-refresh-btn" onclick="reloadConsole(this.closest('.console-panel'), '${escapeHtml(serverName)}')">Refresh</button>
        </div>
        <div class="console-output">${body}</div>
        <div class="console-meta">
            <span>${countText}</span>
            <span>Updated ${updated}</span>
        </div>`;

    const output = panel.querySelector('.console-output');
    if (output) output.scrollTop = output.scrollHeight;
}
