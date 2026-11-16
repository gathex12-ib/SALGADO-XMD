// lib/mediaCache.js — mémoire des messages avec média (SALGA-XMD)
//
// Pour save / humm / waouh : le média est cherché par PLUSIEURS chemins, du plus fiable au moins fiable :
//   1. copie déjà téléchargée à l'arrivée (vues uniques, ou tous les médias si antidelete est actif)
//   2. la copie « citée » dans ta réponse (méthode de CENTRAL-HEX)
//   3. le message d'origine gardé en mémoire (retrouvé grâce à l'identifiant du message cité)
//   4. nouvelle demande du média au téléphone (updateMediaMessage)
const { extractMedia, downloadMedia, mediaSize, getQuoted, botKey } = require('./helpers');

const MSG_MAX = 4000;
const MSG_TTL = 12 * 60 * 60 * 1000;
const BUF_MAX_BYTES = 80 * 1024 * 1024;
const BUF_ITEM_MAX = 25 * 1024 * 1024;

const msgs = new Map(); // `${bot}|${id}` → { message, at }
const bufs = new Map(); // `${bot}|${id}` → { buf, at }
let bufBytes = 0;

const keyOf = (sock, id) => `${botKey(sock)}|${id}`;

function dropBuf(k) {
    const b = bufs.get(k);
    if (b) { bufBytes -= b.buf.length; bufs.delete(k); }
}
function storeBuf(k, buf) {
    if (buf.length > BUF_ITEM_MAX) return;
    dropBuf(k);
    bufs.set(k, { buf, at: Date.now() });
    bufBytes += buf.length;
    while (bufBytes > BUF_MAX_BYTES && bufs.size) dropBuf(bufs.keys().next().value);
}

/** À appeler pour chaque message reçu. `prefetchAll` : télécharger aussi les médias normaux (antidelete actif). */
function remember(sock, message, prefetchAll = false) {
    try {
        const id = message?.key?.id;
        const chat = message?.key?.remoteJid || '';
        if (!id || !message.message || chat === 'status@broadcast' || chat.endsWith('@newsletter')) return;
        const media = extractMedia(message.message);
        if (!media) return;

        const k = keyOf(sock, id);
        msgs.set(k, { message, at: Date.now() });
        if (msgs.size > MSG_MAX) { const old = msgs.keys().next().value; msgs.delete(old); dropBuf(old); }

        const wantBuf = (media.viewOnce || prefetchAll) && !bufs.has(k) && mediaSize(media.content) <= BUF_ITEM_MAX;
        if (wantBuf) {
            downloadMedia(media).then((buf) => storeBuf(k, buf)).catch(() => { /* on réessaiera à la demande */ });
        }
    } catch { /* non critique */ }
}

function purgeOld() {
    const limit = Date.now() - MSG_TTL;
    for (const [k, v] of msgs) if (v.at < limit) { msgs.delete(k); dropBuf(k); }
}
const timer = setInterval(purgeOld, 30 * 60 * 1000);
if (timer.unref) timer.unref();

const find = (sock, id) => (id ? msgs.get(keyOf(sock, id)) || null : null);
const bufferOf = (sock, id) => (id ? bufs.get(keyOf(sock, id))?.buf || null : null);

const NOT_IN_MEMORY =
    "Je n'ai pas ce média en mémoire : WhatsApp ne l'a pas transmis au bot, ou il a été envoyé avant la connexion du bot / son dernier redémarrage. " +
    "Demande à la personne de le renvoyer, puis réessaie dès sa réception.";
const EXPIRED = "Ce média n'est plus disponible sur les serveurs WhatsApp (expiré ou supprimé).";

const coded = (code) => { const e = new Error(code); e.code = code; return e; };
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
    if (!content) return null;
    return downloadMedia({ ...media, content });
}

/**
 * Retrouve le média du message auquel on répond.
 * Retourne { media, buf } ou lève une Error au message clair (français) avec un `code`.
 */
async function resolveQuotedMedia(sock, message) {
    const { quoted, ctx } = getQuoted(message);
    if (!quoted) throw coded('NO_QUOTE');

    const cached = find(sock, ctx.stanzaId);
    const fromQuote = extractMedia(quoted);
    const fromCache = cached ? extractMedia(cached.message.message) : null;
    const media = fromCache || fromQuote;
    if (!media) throw coded('NO_MEDIA');
    media.viewOnce = !!(fromCache?.viewOnce || fromQuote?.viewOnce);

    const tried = [];
    let buf = bufferOf(sock, ctx.stanzaId);                       // 1) déjà téléchargé
    if (!buf) {
        for (const [label, m] of [['copie citée', fromQuote], ['message d\'origine', fromCache]]) {
            if (!m || buf) continue;
            try { buf = await downloadMedia(m); } catch (e) { tried.push(`${label}: ${e.message}`); }   // 2) et 3)
        }
    }
    if (!buf) {                                                   // 4) redemande au téléphone
        try { buf = await retryFromPhone(sock, message, ctx, fromCache || fromQuote); } catch (e) { tried.push(`téléphone: ${e.message}`); }
    }
    if (buf) return { media, buf };

    const node = (fromQuote || fromCache).content;
    console.error('❌ [média] récupération impossible →', tried.join(' | '),
        `(url:${!!node.url} directPath:${!!node.directPath} mediaKey:${!!node.mediaKey} vueUnique:${media.viewOnce} enMémoire:${!!cached})`);
    const noInfo = tried.some((t) => /No valid media URL|directPath/i.test(t)) && !cached;
    const e = new Error(noInfo ? NOT_IN_MEMORY : EXPIRED);
    e.code = 'DOWNLOAD';
    throw e;
}

module.exports = { remember, find, bufferOf, resolveQuotedMedia, NOT_IN_MEMORY, _clear() { msgs.clear(); bufs.clear(); bufBytes = 0; } };
