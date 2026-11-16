// lib/vault.js — coffre à médias de SALGA-XMD
//
// PRINCIPE : on ne compte plus sur la copie « allégée » que WhatsApp joint à une réponse.
// Dès qu'un média ARRIVE sur le compte du bot, on le garde (sur disque, 3 h) ; les commandes
// save / humm / waouh le retrouvent par l'identifiant du message auquel tu réponds.
//
//   • vues uniques : toujours téléchargées à l'arrivée
//   • autres médias : téléchargés à l'arrivée aussi (≤ 20 Mo, 3 h, 300 Mo au total).
//     Pour ne garder QUE les vues uniques : variable VAULT_ALL=0
const fs = require('fs');
const path = require('path');
const { extractMedia, downloadMedia, mediaSize, getQuoted, botKey } = require('./helpers');

const DIR = path.join(process.cwd(), 'temp', 'vault');
const MAX_ITEM = 20 * 1024 * 1024;
const MAX_TOTAL = 300 * 1024 * 1024;
const FILE_TTL = 3 * 60 * 60 * 1000;
const META_TTL = 12 * 60 * 60 * 1000;
const META_MAX = 3000;
const CONCURRENCY = 3;
const EAGER_ALL = process.env.VAULT_ALL !== '0';

const index = new Map();   // `${bot}|${id}` → fiche du média
const byChat = new Map();  // `${bot}|${chat}` → [clés] (les plus récentes en dernier)
const stubs = new Set();   // messages arrivés SANS contenu (WhatsApp ne l'a pas transmis au bot)
const queue = [];
let running = 0;
let totalBytes = 0;

try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* premier démarrage */ }

const keyOf = (sock, id) => `${botKey(sock)}|${id}`;
const fileOf = (k) => path.join(DIR, k.replace(/[^A-Za-z0-9_-]/g, '_') + '.bin');
const coded = (code, message) => { const e = new Error(message || code); e.code = code; return e; };

function dropFile(meta) {
    if (meta.file) {
        totalBytes -= meta.bytes || 0;
        fs.promises.unlink(meta.file).catch(() => {});
        meta.file = null;
    }
}
function dropMeta(k) {
    const meta = index.get(k);
    if (meta) { dropFile(meta); index.delete(k); }
}
function evictOldestFile() {
    let oldest = null;
    for (const m of index.values()) if (m.file && (!oldest || m.at < oldest.at)) oldest = m;
    if (!oldest) { totalBytes = 0; return; }
    dropFile(oldest);
}

async function writeFileFor(meta, buf) {
    await fs.promises.mkdir(DIR, { recursive: true });
    const f = fileOf(meta.k);
    await fs.promises.writeFile(f, buf);
    meta.file = f;
    meta.bytes = buf.length;
    totalBytes += buf.length;
    while (totalBytes > MAX_TOTAL) evictOldestFile();
}

async function storeNow(k) {
    const meta = index.get(k);
    if (!meta || meta.file) return;
    try {
        const buf = await downloadMedia({ kind: meta.kind, content: meta.content });
        await writeFileFor(meta, buf);
    } catch { /* on réessaiera à la demande */ }
}
function pump() {
    while (running < CONCURRENCY && queue.length) {
        const k = queue.shift();
        running++;
        storeNow(k).finally(() => { running--; pump(); });
    }
}
function enqueue(k) {
    if (queue.includes(k)) return;
    queue.push(k);
    pump();
}

/** À appeler pour CHAQUE message reçu : retient les médias et télécharge ceux qui comptent. */
function seen(sock, message) {
    try {
        const id = message?.key?.id;
        const chat = message?.key?.remoteJid || '';
        if (!id || !message.message || chat === 'status@broadcast' || chat.endsWith('@newsletter')) return null;
        const media = extractMedia(message.message);
        if (!media) return null;

        const k = keyOf(sock, id);
        let meta = index.get(k);
        if (!meta) {
            meta = {
                k, id, chat, at: Date.now(), file: null, bytes: 0,
                kind: media.kind, mimetype: media.mimetype, fileName: media.fileName, caption: media.caption,
                ptt: media.ptt, gif: media.gif, viewOnce: media.viewOnce,
                size: mediaSize(media.content), content: media.content
            };
            index.set(k, meta);
            const ck = `${botKey(sock)}|${chat}`;
            const arr = byChat.get(ck) || [];
            arr.push(k);
            if (arr.length > 40) arr.shift();
            byChat.set(ck, arr);
            if (index.size > META_MAX) dropMeta(index.keys().next().value);
        }
        const ts = Number(message.messageTimestamp) || 0;
        const age = ts ? Date.now() / 1000 - ts : 0;
        const want = media.viewOnce ? age < 7200 : (EAGER_ALL && age < 900);
        if (want && !meta.file && (!meta.size || meta.size <= MAX_ITEM)) enqueue(k);
        return meta;
    } catch { return null; }
}

/** Message arrivé sans contenu (vue unique non transmise…). Retourne true la 1re fois. */
function noteStub(sock, message) {
    const k = keyOf(sock, message?.key?.id || '');
    if (!message?.key?.id || stubs.has(k)) return false;
    stubs.add(k);
    if (stubs.size > 1000) stubs.delete(stubs.values().next().value);
    return true;
}

async function readFileFor(meta) {
    if (!meta?.file) return null;
    return fs.promises.readFile(meta.file).catch(() => null);
}
/** Copie gardée en mémoire (ou téléchargée maintenant depuis le message d'origine). */
async function bufferFor(sock, id) {
    const meta = id ? index.get(keyOf(sock, id)) : null;
    if (!meta) return null;
    let buf = await readFileFor(meta);
    if (!buf) {
        try {
            buf = await downloadMedia({ kind: meta.kind, content: meta.content });
            if (buf.length <= MAX_ITEM) await writeFileFor(meta, buf).catch(() => {});
        } catch { buf = null; }
    }
    return buf;
}

function lastInChat(sock, chat, filter) {
    const arr = byChat.get(`${botKey(sock)}|${chat}`) || [];
    for (let i = arr.length - 1; i >= 0; i--) {
        const meta = index.get(arr[i]);
        if (meta && (!filter || filter(meta))) return meta;
    }
    return null;
}

const toMedia = (m, viewOnce) => ({
    kind: m.kind, content: m.content, mimetype: m.mimetype, fileName: m.fileName, caption: m.caption,
    ptt: m.ptt, gif: m.gif, viewOnce: !!(viewOnce || m.viewOnce)
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);

/** Dernier recours : demande au téléphone de renvoyer le média (nécessite la clé du média). */
async function retryFromPhone(sock, message, ctx, media) {
    if (typeof sock.updateMediaMessage !== 'function' || !media?.content?.mediaKey) return null;
    const name = `${media.kind}Message`;
    const fake = {
        key: { remoteJid: message.key.remoteJid, id: ctx.stanzaId, fromMe: false, participant: ctx.participant },
        message: { [name]: media.content }
    };
    const updated = await withTimeout(sock.updateMediaMessage(fake), 25000);
    const content = updated?.message?.[name];
    return content ? downloadMedia({ ...media, content }) : null;
}

const NOT_IN_MEMORY =
    "Je n'ai pas ce média en mémoire : WhatsApp ne l'a pas transmis au bot, ou il a été envoyé avant la connexion du bot / son dernier redémarrage. " +
    'Demande à la personne de le renvoyer, puis réessaie dès sa réception.';
const NO_CONTENT = "WhatsApp n'a pas transmis le contenu de ce message au bot (courant pour les vues uniques sur un appareil lié).";
const EXPIRED = "Ce média n'est plus disponible sur les serveurs WhatsApp (expiré ou supprimé).";

/**
 * Retrouve le média demandé par une commande.
 *  • en réponse à un message : coffre → copie citée → relance au téléphone
 *  • sans réponse            : le dernier média reçu dans cette discussion
 * Retourne { media, buf, source } ou lève une Error { code, message, diag }.
 */
async function resolveForCommand(sock, message, { preferViewOnce = false } = {}) {
    const { quoted, ctx } = getQuoted(message);
    const chat = message.key.remoteJid;

    // ── Sans réponse : dernier média de la discussion
    if (!quoted) {
        const meta = (preferViewOnce && lastInChat(sock, chat, (m) => m.viewOnce)) || lastInChat(sock, chat, null);
        if (!meta) throw coded('NO_QUOTE');
        const buf = await bufferFor(sock, meta.id);
        if (!buf) throw Object.assign(coded('DOWNLOAD', EXPIRED), { diag: `dernierMédia:true téléchargeable:false` });
        return { media: toMedia(meta), buf, source: 'dernier média' };
    }

    // ── En réponse à un message
    const id = ctx.stanzaId;
    const meta = id ? index.get(keyOf(sock, id)) : null;
    const fromQuote = extractMedia(quoted);
    if (!meta && !fromQuote) throw coded('NO_MEDIA');
    const viewOnce = !!(meta?.viewOnce || fromQuote?.viewOnce);

    if (meta) {
        const buf = await bufferFor(sock, id);
        if (buf) return { media: toMedia(meta, viewOnce), buf, source: 'coffre' };
    }
    const tried = [];
    if (fromQuote) {
        try { return { media: { ...fromQuote, viewOnce }, buf: await downloadMedia(fromQuote), source: 'copie citée' }; }
        catch (e) { tried.push(`copie citée: ${e.message}`); }
    }
    try {
        const buf = await retryFromPhone(sock, message, ctx, meta ? toMedia(meta) : fromQuote);
        if (buf) return { media: meta ? toMedia(meta, viewOnce) : { ...fromQuote, viewOnce }, buf, source: 'téléphone' };
    } catch (e) { tried.push(`téléphone: ${e.message}`); }

    const node = (fromQuote || meta).content;
    const stub = stubs.has(keyOf(sock, id));
    const diag = `url:${!!node.url} · directPath:${!!node.directPath} · mediaKey:${!!node.mediaKey} · vueUnique:${viewOnce} · enMémoire:${!!meta} · reçuSansContenu:${stub}`;
    console.error('❌ [média] récupération impossible →', tried.join(' | '), `(${diag})`);
    throw Object.assign(coded('DOWNLOAD', stub ? NO_CONTENT : (meta ? EXPIRED : NOT_IN_MEMORY)), { diag, viewOnce });
}

const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, m] of index) {
        if (m.file && now - m.at > FILE_TTL) dropFile(m);
        if (now - m.at > META_TTL) dropMeta(k);
    }
}, 15 * 60 * 1000);
if (timer.unref) timer.unref();

module.exports = { seen, noteStub, bufferFor, lastInChat, resolveForCommand, NOT_IN_MEMORY, _reset() { for (const k of [...index.keys()]) dropMeta(k); byChat.clear(); stubs.clear(); queue.length = 0; } };
