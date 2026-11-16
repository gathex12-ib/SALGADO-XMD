// commands/antidelete.js — SALGA-XMD — propriétaire uniquement
// Quand quelqu'un supprime un message (groupe ou privé), le bot t'envoie en privé un rapport
// avec le message supprimé (texte, image, vidéo, audio, sticker, document, vue unique).
const fs = require('fs');
const path = require('path');
const {
    extractMedia, downloadMedia, buildMediaPayload, unwrapMessage, getText,
    resolveDm, ownJid, botKey, jidNum, digits, KIND_LABEL
} = require('../lib/helpers');

const vault = require('../lib/vault');
const FILE = path.join(__dirname, '../data/antidelete.json');
const CACHE_MAX = 3000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // on garde les messages 6 h en mémoire

const cache = new Map(); // `${bot}|${chat}|${id}` → { message, at }

function readState() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } }
function writeState(s) {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch (e) { console.error('❌ [antidelete] état:', e.message); }
}
const getCfg = (sock) => readState()[botKey(sock)] || { enabled: false, target: null };
const isAntideleteOn = (sock) => getCfg(sock).enabled === true;

async function antideleteCommand(sock, chatId, senderId, message, args, isOwner) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    if (!isOwner) return reply('❌ La commande *antidelete* est réservée au propriétaire du bot.');

    const action = (args?.[0] || '').toLowerCase();
    const state = readState();
    const key = botKey(sock);
    const cur = state[key] || { enabled: false, target: null };

    if (action === 'on') {
        state[key] = { enabled: true, target: resolveDm(sock, message, senderId) };
        writeState(state);
        return reply('🟢 *Anti-suppression activé.*\nQuand quelqu\'un supprime un message (groupe ou privé), je t\'envoie un rapport en privé avec le contenu supprimé.\n\n_Seuls les messages reçus *depuis l\'activation* peuvent être récupérés._');
    }
    if (action === 'off') {
        state[key] = { enabled: false, target: cur.target };
        writeState(state);
        for (const k of [...cache.keys()]) if (k.startsWith(key + '|')) cache.delete(k);
        return reply('🔴 *Anti-suppression désactivé.*');
    }
    return reply(`🗑️ *ANTI-SUPPRESSION*\n━━━━━━━━━━━━━━━━━━━━\n📊 *Statut :* ${cur.enabled ? '🟢 Activé' : '🔴 Désactivé'}\n\n• *antidelete on* → activer\n• *antidelete off* → désactiver\n\nLes rapports arrivent dans ton privé (texte, image, vidéo, audio, sticker, document, vue unique).`);
}

/** Mémorise un message reçu (uniquement si l'anti-suppression est actif). */
function cacheMessage(sock, message) {
    try {
        if (!isAntideleteOn(sock)) return;
        const chat = message?.key?.remoteJid;
        if (!message?.message || !chat || chat === 'status@broadcast' || message.key.fromMe) return;
        const inner = unwrapMessage(message.message);
        if (inner?.protocolMessage || inner?.senderKeyDistributionMessage && Object.keys(inner).length === 1) return;
        const k = `${botKey(sock)}|${chat}|${message.key.id}`;
        cache.set(k, { message, at: Date.now() });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    } catch { /* non critique */ }
}

function describeType(msg) {
    const media = extractMedia(msg);
    if (media) return `${KIND_LABEL[media.kind]}${media.viewOnce ? ' (vue unique)' : ''}`;
    const m = unwrapMessage(msg) || {};
    if (m.contactMessage || m.contactsArrayMessage) return 'Contact';
    if (m.locationMessage || m.liveLocationMessage) return 'Localisation';
    if (m.pollCreationMessage || m.pollCreationMessageV3) return 'Sondage';
    return 'Texte';
}

function fmt(ts) {
    return new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
}

/** Traite les événements messages.update : détecte les suppressions et envoie le rapport. */
async function handleMessageUpdate(sock, updates) {
    if (!isAntideleteOn(sock)) return;
    for (const u of updates || []) {
        try {
            const upd = u?.update;
            const isRevoke = upd && (upd.messageStubType === 1 || upd.messageStubType === 'REVOKE' || upd.message === null);
            if (!isRevoke || !u.key?.id) continue;

            const chat = u.key.remoteJid;
            const entry = cache.get(`${botKey(sock)}|${chat}|${u.key.id}`);
            if (!entry) continue;
            cache.delete(`${botKey(sock)}|${chat}|${u.key.id}`);
            await report(sock, chat, entry, u);
        } catch (e) {
            console.error('❌ [antidelete]', e.message);
        }
    }
}

async function report(sock, chat, entry, u) {
    const orig = entry.message;
    const cfg = getCfg(sock);
    const target = cfg.target || ownJid(sock);
    const isGroup = chat.endsWith('@g.us');

    const sender = orig.key.participant || orig.key.remoteJid;
    const senderPn = [sender, orig.key.participantAlt, orig.key.remoteJidAlt].find((j) => j && String(j).endsWith('@s.whatsapp.net')) || sender;
    const deleter = u.key.participant || (isGroup ? sender : orig.key.remoteJid);
    const mentions = [...new Set([sender, deleter].filter(Boolean))];

    let where = 'Message privé';
    if (isGroup) {
        try { where = `Groupe : ${(await sock.groupMetadata(chat)).subject}`; } catch { where = 'Groupe'; }
    }

    const media = extractMedia(orig.message);
    const text = getText(orig.message);
    const head =
        `🗑️ *MESSAGE SUPPRIMÉ*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Auteur :* @${jidNum(sender)}${orig.pushName ? ` (${orig.pushName})` : ''}\n` +
        `📞 *Numéro :* +${digits(senderPn)}\n` +
        `🗑️ *Supprimé par :* @${jidNum(deleter)}\n` +
        `💬 *Chat :* ${where}\n` +
        `📎 *Type :* ${describeType(orig.message)}\n` +
        `🕐 *Envoyé :* ${fmt((Number(orig.messageTimestamp) || Math.floor(entry.at / 1000)) * 1000)}\n` +
        `🕐 *Supprimé :* ${fmt(Date.now())}`;

    if (media) {
        try {
            const buf = (await vault.bufferFor(sock, orig.key.id)) || await downloadMedia(media);
            const body = `${head}${media.caption ? `\n\n💬 ${media.caption}` : ''}`;
            const payload = buildMediaPayload(media, buf, body);
            if (media.kind === 'sticker' || media.kind === 'audio') {
                await sock.sendMessage(target, payload);
                await sock.sendMessage(target, { text: head, mentions });
            } else {
                await sock.sendMessage(target, { ...payload, mentions });
            }
            return;
        } catch (e) {
            console.error('❌ [antidelete] média:', e.message);
            await sock.sendMessage(target, { text: `${head}\n\n⚠️ Le média n'a pas pu être récupéré (${e.message}).`, mentions });
            return;
        }
    }
    await sock.sendMessage(target, { text: `${head}\n\n💬 ${text || '(contenu non textuel)'}`, mentions });
}

module.exports = { antideleteCommand, isAntideleteOn, cacheMessage, handleMessageUpdate, _cache: cache };
