// lib/helpers.js — utilitaires partagés (JID, médias, messages) — SALGA-XMD
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const digits = (s) => String(s || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
const jidNum = (jid) => String(jid || '').split(':')[0].split('@')[0];
const isLid = (jid) => String(jid || '').endsWith('@lid');

/** JID du compte du bot (le téléphone lié à cette session). */
function ownJid(sock) {
    return jidNum(sock?.user?.id) + '@s.whatsapp.net';
}

/** Identifiant court de la session (numéro du bot), utilisé comme clé de stockage. */
function botKey(sock) {
    return jidNum(sock?.user?.id) || 'default';
}

/**
 * JID vers lequel écrire en privé à la personne qui a tapé la commande.
 * - message envoyé depuis le compte du bot → son propre chat
 * - sinon on préfère le vrai numéro (@s.whatsapp.net) au LID quand WhatsApp le fournit.
 */
function resolveDm(sock, message, senderId) {
    if (message?.key?.fromMe) return ownJid(sock);
    const candidates = [senderId, message?.key?.participantAlt, message?.key?.remoteJidAlt, message?.participantAlt].filter(Boolean);
    const pn = candidates.find((j) => String(j).endsWith('@s.whatsapp.net'));
    return pn || senderId;
}

/** Retire les enveloppes (messages éphémères, vue unique, document+légende). */
function unwrapMessage(msg) {
    let m = msg;
    for (let i = 0; i < 6 && m; i++) {
        const inner =
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message;
        if (!inner) break;
        m = inner;
    }
    return m || null;
}

/** Texte d'un message (conversation, texte étendu, légende image/vidéo/document). */
function getText(msg) {
    const m = unwrapMessage(msg);
    if (!m) return '';
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        ''
    ).trim();
}

/** contextInfo du message (réponse, mentions…), quel que soit son type. */
function getContextInfo(msg) {
    const m = unwrapMessage(msg);
    if (!m) return {};
    for (const key of Object.keys(m)) {
        const ci = m[key]?.contextInfo;
        if (ci) return ci;
    }
    return {};
}

/** Média cité (réponse) : { quoted, ctx }. */
function getQuoted(message) {
    const ctx = getContextInfo(message.message);
    return { quoted: ctx.quotedMessage || null, ctx };
}

/**
 * Détecte un média dans un message (cité ou non).
 * Retourne { kind, content, viewOnce, mimetype, fileName, caption, ptt, gif } ou null.
 */
function extractMedia(msg) {
    if (!msg) return null;
    let m = msg;
    let viewOnce = false;
    for (let i = 0; i < 6 && m; i++) {
        const vo = m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message;
        if (vo) { viewOnce = true; m = vo; continue; }
        const inner = m.ephemeralMessage?.message || m.documentWithCaptionMessage?.message;
        if (inner) { m = inner; continue; }
        break;
    }
    const defs = [
        ['imageMessage', 'image'], ['videoMessage', 'video'], ['ptvMessage', 'video'],
        ['audioMessage', 'audio'], ['stickerMessage', 'sticker'], ['documentMessage', 'document']
    ];
    for (const [key, kind] of defs) {
        const c = m[key];
        if (!c) continue;
        return {
            kind,
            content: c,
            viewOnce: viewOnce || c.viewOnce === true,
            mimetype: c.mimetype || '',
            fileName: c.fileName || '',
            caption: c.caption || '',
            ptt: !!c.ptt,
            gif: !!c.gifPlayback
        };
    }
    return null;
}

const KIND_LABEL = { image: 'Image', video: 'Vidéo', audio: 'Audio', sticker: 'Sticker', document: 'Document' };

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

function mediaSize(content) {
    const fl = content?.fileLength;
    if (fl === undefined || fl === null) return 0;
    return typeof fl === 'object' && typeof fl.toNumber === 'function' ? fl.toNumber() : Number(fl) || 0;
}

/** Télécharge le contenu d'un média. Lève une erreur claire si trop gros ou expiré. */
async function downloadMedia(media) {
    if (mediaSize(media.content) > MAX_MEDIA_BYTES) throw new Error('Média trop volumineux (max 100 Mo).');
    const stream = await downloadContentFromMessage(media.content, media.kind);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new Error('Média vide ou expiré.');
    return buf;
}

/** Construit le message Baileys qui renvoie le média à l'identique. */
function buildMediaPayload(media, buf, caption) {
    switch (media.kind) {
        case 'image': return { image: buf, caption };
        case 'video': return { video: buf, caption, gifPlayback: media.gif, mimetype: media.mimetype || 'video/mp4' };
        case 'audio': return { audio: buf, mimetype: media.mimetype || 'audio/mp4', ptt: media.ptt };
        case 'sticker': return { sticker: buf };
        case 'document': return { document: buf, caption, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || 'fichier' };
        default: return null;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
    digits, jidNum, isLid, ownJid, botKey, resolveDm,
    unwrapMessage, getText, getContextInfo, getQuoted,
    extractMedia, downloadMedia, buildMediaPayload, mediaSize, KIND_LABEL, sleep
};
