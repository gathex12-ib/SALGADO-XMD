// commands/antibot.js — SALGA-XMD (basé sur l'anti-bot de CENTRAL-HEX)
// antibot on  → supprime le message du bot détecté, annonce, puis l'EXPULSE (le bot doit être admin)
// antibot off → désactivé
// Jamais appliqué aux admins, au propriétaire, ni à soi-même.
const fs = require('fs');
const path = require('path');
const { unwrapMessage, getContextInfo, jidNum } = require('../lib/helpers');

const ANTIBOT_FILE = path.join(__dirname, '../data/antibot.json');

function readState() { try { return JSON.parse(fs.readFileSync(ANTIBOT_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(path.dirname(ANTIBOT_FILE), { recursive: true }); fs.writeFileSync(ANTIBOT_FILE, JSON.stringify(s, null, 2)); }

/** 'off' | 'on' (anciens formats : true / 'kick' = on) */
function getAntibotMode(chatId) {
    const v = readState()[chatId];
    return v === true || v === 'on' || v === 'kick' ? 'on' : 'off';
}
const isAntibotEnabled = (chatId) => getAntibotMode(chatId) !== 'off';

// ── Détection ───────────────────────────────────────────────────────────────
// FORT  : un téléphone / WhatsApp Web ne peut pas fabriquer ces éléments (boutons, listes, aperçus
//         publicitaires, score de transfert truqué) ou identifiants propres à des bibliothèques de bots.
// FAIBLE: règle de CENTRAL-HEX (identifiant de 16 caractères hexadécimaux) : supprimé tout de suite,
//         mais expulsion seulement à la 2e détection en 10 minutes (pour éviter d'expulser un humain à tort).
const BOT_MESSAGE_TYPES = ['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage', 'highlyStructuredMessage', 'productMessage', 'carouselMessage'];

function detect(message) {
    const id = String(message?.key?.id || '');
    if (id.startsWith('BAE5')) return { reason: 'id-BAE5', strong: true };
    if (/^3EB0[0-9A-F]{36}$/.test(id)) return { reason: 'id-baileys-40', strong: true };

    const inner = unwrapMessage(message?.message) || {};
    for (const t of BOT_MESSAGE_TYPES) if (inner[t]) return { reason: t, strong: true };

    const ctx = getContextInfo(message?.message);
    if (Number(ctx.forwardingScore) >= 900) return { reason: 'forwardingScore', strong: true };
    if (ctx.externalAdReply && !ctx.isForwarded) return { reason: 'externalAdReply', strong: true };

    if (/^[A-F0-9]{16}$/.test(id) && !id.startsWith('3EB0')) return { reason: 'id-16-hex', strong: false };
    return null;
}
const botReason = (message) => detect(message)?.reason || null;
const looksLikeBot = (message) => detect(message) !== null;

async function antibotCommand(sock, chatId, message, args, isSenderAdmin, isBotAdmin) {
    const reply = (content) => sock.sendMessage(chatId, content, { quoted: message });
    if (!chatId.endsWith('@g.us')) return reply({ text: '❌ *Uniquement dans les groupes !*' });
    if (!isSenderAdmin) return reply({ text: '❌ Réservé aux admins du groupe.' });

    const state = readState();
    const action = (Array.isArray(args) ? args[0] : args || '').toLowerCase();
    const mode = getAntibotMode(chatId);

    if (!action) {
        return reply({
            text: `🛡️ *ANTI-BOT*\n━━━━━━━━━━━━━━━━━━━━\n📊 *Statut :* ${mode === 'on' ? '🟢 Activé' : '🔴 Désactivé'}\n\nUtilise : *antibot on* ou *antibot off*\n\nQuand un bot est détecté : son message est supprimé et il est expulsé.\n⚠️ Le bot doit être *admin* du groupe pour agir.\nℹ️ Un bot qui envoie du texte simple avec un identifiant « normal » ne peut pas être reconnu automatiquement.`
        });
    }
    if (action === 'on' || action === 'kick') {
        state[chatId] = 'on';
        saveState(state);
        return reply({
            text: `🟢 *Anti-bot* activé.${isBotAdmin === false ? '\n⚠️ Attention : le bot doit être *admin* pour agir.' : ''}\n\n🛡️ Les bots détectés seront supprimés puis expulsés.`
        });
    }
    if (action === 'off') {
        state[chatId] = 'off';
        saveState(state);
        return reply({ text: '🔴 *Anti-bot* désactivé.' });
    }
    return reply({ text: '❌ Option inconnue. Utilise : *antibot on* ou *antibot off*' });
}

const weakStrikes = new Map(); // `${chat}|${sender}` → [timestamps]

/**
 * Appelée par main.js pour chaque message de groupe d'un non-propriétaire quand l'anti-bot est actif.
 * Retourne true si le message vient d'un bot (il ne doit alors plus être traité).
 */
async function handleAntibot(sock, chatId, senderId, message, isAdmin) {
    if (getAntibotMode(chatId) === 'off' || message.key.fromMe) return false;
    const det = detect(message);
    if (!det) return false;

    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin) return false;            // on ne touche jamais aux admins
        if (!isBotAdmin) return true;               // impossible d'agir : on ignore simplement le bot

        await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant || senderId } });

        let kick = det.strong;
        if (!kick) {
            const k = `${chatId}|${senderId}`;
            const now = Date.now();
            const arr = (weakStrikes.get(k) || []).filter((t) => now - t < 10 * 60 * 1000);
            arr.push(now);
            weakStrikes.set(k, arr);
            kick = arr.length >= 2;
        }
        if (kick) {
            await sock.sendMessage(chatId, { text: `🤖 *ANTIBOT*\n@${jidNum(senderId)} ressemble à un bot et a été expulsé.\n\n> SALGA-XMD 🥷`, mentions: [senderId] });
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
        }
        console.log(`🤖 [antibot] bot détecté (${det.reason}) dans ${chatId}${kick ? ' → expulsé' : ''}`);
    } catch (e) {
        console.error('❌ [antibot]', e.message);
    }
    return true;
}

module.exports = { antibotCommand, isAntibotEnabled, getAntibotMode, botReason, looksLikeBot, handleAntibot };
