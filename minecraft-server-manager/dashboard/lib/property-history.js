const fs = require('fs');
const path = require('path');
const { parseServerProperties, writeServerProperties } = require('./server-properties');

const HISTORY_FILE = 'server.properties.history';

function getHistoryPath(serverDir) {
    return path.join(serverDir, HISTORY_FILE);
}

function readPropertyHistory(serverDir) {
    const historyPath = getHistoryPath(serverDir);
    if (!fs.existsSync(historyPath)) return [];
    try {
        let raw = fs.readFileSync(historyPath, 'utf-8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function saveHistory(serverDir, history) {
    fs.writeFileSync(getHistoryPath(serverDir), JSON.stringify(history, null, 2), 'utf-8');
}

function appendPropertyHistory(serverDir, changes) {
    const history = readPropertyHistory(serverDir);
    history.push({
        timestamp: new Date().toISOString(),
        type: 'edit',
        changes,
        reverted: false
    });
    saveHistory(serverDir, history);
}

function revertPropertyChange(serverDir, entryIndex) {
    const history = readPropertyHistory(serverDir);
    if (entryIndex < 0 || entryIndex >= history.length) {
        throw new Error(`Invalid history index: ${entryIndex}`);
    }

    const entry = history[entryIndex];
    if (entry.reverted) {
        throw new Error('This change has already been reverted');
    }

    // Build updates from old values
    const updates = {};
    const auditChanges = {};
    const propsPath = path.join(serverDir, 'server.properties');
    const currentProps = parseServerProperties(propsPath);

    for (const [key, change] of Object.entries(entry.changes)) {
        updates[key] = change.old;
        auditChanges[key] = { old: currentProps[key] || change.new, new: change.old };
    }

    writeServerProperties(propsPath, updates);
    entry.reverted = true;

    // Log the undo as an audit entry
    history.push({
        timestamp: new Date().toISOString(),
        type: 'undo',
        sourceIndex: entryIndex,
        changes: auditChanges,
        reverted: false
    });

    saveHistory(serverDir, history);
}

function redoPropertyChange(serverDir, entryIndex) {
    const history = readPropertyHistory(serverDir);
    if (entryIndex < 0 || entryIndex >= history.length) {
        throw new Error(`Invalid history index: ${entryIndex}`);
    }

    const entry = history[entryIndex];
    if (!entry.reverted) {
        throw new Error('This change has not been reverted');
    }

    // Build updates from new values
    const updates = {};
    const auditChanges = {};
    const propsPath = path.join(serverDir, 'server.properties');
    const currentProps = parseServerProperties(propsPath);

    for (const [key, change] of Object.entries(entry.changes)) {
        updates[key] = change.new;
        auditChanges[key] = { old: currentProps[key] || change.old, new: change.new };
    }

    writeServerProperties(propsPath, updates);
    entry.reverted = false;

    // Log the redo as an audit entry
    history.push({
        timestamp: new Date().toISOString(),
        type: 'redo',
        sourceIndex: entryIndex,
        changes: auditChanges,
        reverted: false
    });

    saveHistory(serverDir, history);
}

module.exports = { readPropertyHistory, appendPropertyHistory, revertPropertyChange, redoPropertyChange };
