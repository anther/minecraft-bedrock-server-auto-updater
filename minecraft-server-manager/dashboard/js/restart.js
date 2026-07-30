// Server restart controls (per-card + Restart All).
// Depends on globals from index.html: refresh (and window._serverData for names).

async function restartServer(serverName, btn) {
    if (!confirm(`Restart "${serverName}"?\n\nThis force-stops the server and relaunches it. Any connected players will be disconnected.`)) {
        return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Restarting...';

    try {
        const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) {
            alert(`Restart failed: ${data.error || res.status}`);
            return;
        }
        await refresh();
    } catch (err) {
        alert(`Restart failed: ${err.message}`);
    } finally {
        // Card may have been re-rendered by refresh(); guard against a detached node.
        if (btn.isConnected) {
            btn.disabled = false;
            btn.textContent = original;
        }
    }
}

async function restartAllServers(btn) {
    const names = Object.keys(window._serverData || {});
    const count = names.length;
    if (!count) {
        alert('No servers to restart.');
        return;
    }
    if (!confirm(`Restart all ${count} server${count === 1 ? '' : 's'}?\n\nEach is force-stopped and relaunched. All connected players will be disconnected.`)) {
        return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Restarting all...';

    try {
        const res = await fetch('/api/restart-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        const failed = (data.results || []).filter(r => !r.ok);
        if (failed.length) {
            alert(`${data.message}\n\nFailed:\n${failed.map(f => `- ${f.name}: ${f.error}`).join('\n')}`);
        }
        await refresh();
    } catch (err) {
        alert(`Restart all failed: ${err.message}`);
    } finally {
        if (btn.isConnected) {
            btn.disabled = false;
            btn.textContent = original;
        }
    }
}
