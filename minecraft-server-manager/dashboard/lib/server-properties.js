const fs = require('fs');

function parseServerProperties(filePath) {
    const props = {};
    try {
        const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;
            props[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
        }
    } catch { /* ignore */ }
    return props;
}

function writeServerProperties(filePath, updates) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const updatedKeys = new Set();

    const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) return line;
        const key = trimmed.substring(0, eqIndex).trim();
        if (key in updates) {
            updatedKeys.add(key);
            return `${key}=${updates[key]}`;
        }
        return line;
    });

    // Append any keys that weren't already in the file
    for (const key of Object.keys(updates)) {
        if (!updatedKeys.has(key)) {
            newLines.push(`${key}=${updates[key]}`);
        }
    }

    fs.writeFileSync(filePath, newLines.join('\r\n'), 'utf-8');
}

module.exports = { parseServerProperties, writeServerProperties };
