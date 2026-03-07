const PROPERTY_RULES = {
    'server-name': {
        type: 'string',
        validate: v => typeof v === 'string' && v.length > 0 && !v.includes(';'),
        message: 'Must be a non-empty string without semicolons'
    },
    'gamemode': {
        type: 'enum',
        values: ['survival', 'creative', 'adventure'],
        message: 'Must be survival, creative, or adventure'
    },
    'difficulty': {
        type: 'enum',
        values: ['peaceful', 'easy', 'normal', 'hard'],
        message: 'Must be peaceful, easy, normal, or hard'
    },
    'server-port': {
        type: 'integer',
        min: 1, max: 65535,
        message: 'Must be an integer between 1 and 65535'
    },
    'server-portv6': {
        type: 'integer',
        min: 1, max: 65535,
        message: 'Must be an integer between 1 and 65535'
    },
    'max-players': {
        type: 'integer',
        min: 1, max: 1000,
        message: 'Must be a positive integer (1-1000)'
    },
    'allow-cheats': {
        type: 'enum',
        values: ['true', 'false'],
        message: 'Must be true or false'
    },
    'online-mode': {
        type: 'enum',
        values: ['true', 'false'],
        message: 'Must be true or false'
    },
    'view-distance': {
        type: 'integer',
        min: 5, max: 96,
        message: 'Must be an integer of 5 or greater (max 96)'
    },
    'tick-distance': {
        type: 'integer',
        min: 4, max: 12,
        message: 'Must be an integer between 4 and 12'
    },
    'player-idle-timeout': {
        type: 'integer',
        min: 0, max: 9999,
        message: 'Must be a non-negative integer (0 = disabled)'
    }
};

function validatePropertyUpdates(updates) {
    const errors = [];

    for (const [key, value] of Object.entries(updates)) {
        const rule = PROPERTY_RULES[key];
        if (!rule) {
            errors.push({ key, message: `Unknown or non-editable property: ${key}` });
            continue;
        }

        const strValue = String(value);

        if (rule.type === 'enum') {
            if (!rule.values.includes(strValue)) {
                errors.push({ key, message: rule.message });
            }
        } else if (rule.type === 'integer') {
            const num = parseInt(strValue, 10);
            if (isNaN(num) || String(num) !== strValue || num < rule.min || num > rule.max) {
                errors.push({ key, message: rule.message });
            }
        } else if (rule.type === 'string') {
            if (!rule.validate(strValue)) {
                errors.push({ key, message: rule.message });
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validatePropertyUpdates, PROPERTY_RULES };
