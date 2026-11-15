// lib/counter.js — compteur de messages par membre et par groupe (SALGA-XMD)
// Stocké dans data/messageCount.json → "messageCount": { groupe: { numéro: total } }
const fs = require('fs');
const path = require('path');
const { digits } = require('./helpers');

const FILE = path.join(__dirname, '../data/messageCount.json');
let counts = null;
let timer = null;

function load() {
    if (counts) return;
    try { counts = JSON.parse(fs.readFileSync(FILE, 'utf8')).messageCount || {}; } catch { counts = {}; }
}
function flush() {
    timer = null;
    try {
        let data = {};
        try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* nouveau fichier */ }
        data.messageCount = counts;
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('❌ [counter]', e.message); }
}

function increment(groupId, userJid) {
    const id = digits(userJid);
    if (!groupId || !id) return;
    load();
    counts[groupId] = counts[groupId] || {};
    counts[groupId][id] = (counts[groupId][id] || 0) + 1;
    if (!timer) { timer = setTimeout(flush, 5000); if (timer.unref) timer.unref(); }
}

/** Total pour un membre, en additionnant ses éventuels identifiants (numéro + LID). */
function getCount(groupId, ...jids) {
    load();
    const g = counts[groupId] || {};
    const seen = new Set();
    let total = 0;
    for (const j of jids) {
        const id = digits(j);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        total += g[id] || 0;
    }
    return total;
}

module.exports = { increment, getCount, flush, _reset() { counts = null; } };
