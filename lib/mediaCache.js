// lib/mediaCache.js — mémoire des messages avec média (SALGA-XMD)
//
// POURQUOI : quand on répond à un message, WhatsApp n'envoie qu'une copie « allégée » du message cité
// (sans adresse de téléchargement ni clé) → erreur « No valid media URL or directPath present in message ».
// On garde donc l'ORIGINAL en mémoire (retrouvé grâce à l'identifiant du message cité), et on
// pré-télécharge les médias « vue unique » dès leur arrivée (ils peuvent disparaître des serveurs).
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
    "Je n'ai pas ce média en mémoire : il a été envoyé avant la connexion du bot ou avant son dernier redémarrage. " +
    'Demande à la personne de le renvoyer, puis réessaie.';

/**
 * Retrouve le média du message auquel on répond.
 * Retourne { media, buf } ou lève une Error au message clair (français).
 */
async function resolveQuotedMedia(sock, message) {
    const { quoted, ctx } = getQuoted(message);
    if (!quoted) { const e = new Error('NO_QUOTE'); e.code = 'NO_QUOTE'; throw e; }

    const cached = find(sock, ctx.stanzaId);
    const media = (cached && extractMedia(cached.message.message)) || extractMedia(quoted);
    if (!media) { const e = new Error('NO_MEDIA'); e.code = 'NO_MEDIA'; throw e; }

    // 1) pré-téléchargé  2) téléchargement depuis le message d'origine  3) copie citée (rarement complète)
    let buf = bufferOf(sock, ctx.stanzaId);
    if (!buf) {
        try {
            buf = await downloadMedia(media);
        } catch (err) {
            const text = String(err.message || err);
            const e = new Error(/No valid media URL|directPath/i.test(text) && !cached
                ? NOT_IN_MEMORY
                : /No valid media URL|directPath|404|410|expired|stream/i.test(text)
                    ? "Ce média n'est plus disponible sur les serveurs WhatsApp (expiré ou supprimé)."
                    : text);
            e.code = 'DOWNLOAD';
            throw e;
        }
    }
    return { media, buf };
}

module.exports = { remember, find, bufferOf, resolveQuotedMedia, NOT_IN_MEMORY, _clear() { msgs.clear(); bufs.clear(); bufBytes = 0; } };
