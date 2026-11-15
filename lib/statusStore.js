// lib/statusStore.js — mémoire des statuts WhatsApp reçus (SALGA-XMD)
// Les statuts durent 24 h : on garde ceux reçus pendant ce temps (sur disque, pour survivre
// à un redémarrage) et on peut les renvoyer à la demande ou automatiquement.
const fs = require('fs');
const path = require('path');
const { extractMedia, digits, jidNum, getText, botKey } = require('./helpers');

const DIR = path.join(__dirname, '../data');
const CACHE_FILE = path.join(DIR, 'status_cache.json');
const SETTINGS_FILE = path.join(DIR, 'status_settings.json');
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 250;

// JSON ↔ Buffer : les clés de média sont des octets, on les encode en base64
const replacer = (k, v) => {
    if (v && v.type === 'Buffer' && Array.isArray(v.data)) return { __b64: Buffer.from(v.data).toString('base64') };
    if (v instanceof Uint8Array) return { __b64: Buffer.from(v).toString('base64') };
    if (v && typeof v === 'object' && typeof v.toNumber === 'function' && 'low' in v) return v.toNumber();
    return v;
};
const reviver = (k, v) => (v && typeof v === 'object' && typeof v.__b64 === 'string' ? Buffer.from(v.__b64, 'base64') : v);

let cache = null; // { [botKey]: Item[] }
let cfg = null;   // { [botKey]: { auto: bool, target: jid } }
let timer = null;

function load() {
    if (cache) return;
    try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'), reviver); } catch { cache = {}; }
    try { cfg = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { cfg = {}; }
}
function prune(list) {
    const limit = Date.now() - TTL_MS;
    return list.filter((i) => i.ts > limit).slice(-MAX_ITEMS);
}
function flush() {
    timer = null;
    try {
        fs.mkdirSync(DIR, { recursive: true });
        for (const k of Object.keys(cache)) cache[k] = prune(cache[k]);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, replacer));
    } catch (e) { console.error('❌ [status] sauvegarde:', e.message); }
}
function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(flush, 3000);
    if (timer.unref) timer.unref();
}
function saveCfg() {
    try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cfg, null, 2)); } catch (e) { /* ignore */ }
}

/** Transforme un message reçu sur status@broadcast en entrée mémorisable (ou null). */
function toItem(message) {
    if (!message?.message || message.key?.fromMe) return null;
    const poster = message.key.participant || message.participant || '';
    if (!poster) return null;
    const pn = [poster, message.key.participantAlt].find((j) => j && String(j).endsWith('@s.whatsapp.net'));
    const media = extractMedia(message.message);
    const text = getText(message.message);
    if (!media && !text) return null;
    if (media && media.kind === 'sticker') return null;
    const ts = (Number(message.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000;
    return {
        id: message.key.id,
        poster,
        num: digits(pn || poster),
        isLidOnly: !pn,
        name: message.pushName || '',
        type: media ? media.kind : 'text',
        caption: media ? media.caption : text,
        ts,
        content: message.message
    };
}

function add(sock, message) {
    load();
    const item = toItem(message);
    if (!item) return null;
    const k = botKey(sock);
    cache[k] = cache[k] || [];
    if (cache[k].some((i) => i.id === item.id && i.poster === item.poster)) return null;
    cache[k].push(item);
    cache[k] = prune(cache[k]);
    scheduleFlush();
    return item;
}

function list(sock) {
    load();
    const k = botKey(sock);
    cache[k] = prune(cache[k] || []);
    return cache[k];
}

/** Regroupe par contact : [{ key, name, num, items[] }] (plus récent d'abord). */
function groupByContact(sock) {
    const map = new Map();
    for (const it of list(sock)) {
        const key = it.num || jidNum(it.poster);
        if (!map.has(key)) map.set(key, { key, name: it.name, num: it.num, isLidOnly: it.isLidOnly, items: [] });
        const g = map.get(key);
        if (it.name) g.name = it.name;
        g.items.push(it);
    }
    return [...map.values()].sort((a, b) => b.items[b.items.length - 1].ts - a.items[a.items.length - 1].ts);
}

function findById(sock, id) {
    return list(sock).find((i) => i.id === id) || null;
}

function clear(sock) {
    load();
    const n = (cache[botKey(sock)] || []).length;
    cache[botKey(sock)] = [];
    scheduleFlush();
    return n;
}

function getAuto(sock) {
    load();
    return cfg[botKey(sock)] || { auto: false, target: null };
}
function setAuto(sock, auto, target) {
    load();
    cfg[botKey(sock)] = { auto: !!auto, target: target || cfg[botKey(sock)]?.target || null };
    saveCfg();
}

module.exports = { add, list, groupByContact, findById, clear, getAuto, setAuto, toItem, flush, TTL_MS, _reset() { cache = null; cfg = null; } };
