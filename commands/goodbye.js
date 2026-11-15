// commands/goodbye.js — "goodbye on/off/set/reset" + message de départ (SALGA-XMD)
// ⚠️ Le message d'au revoir n'est envoyé QUE si "goodbye on" a été tapé dans le groupe.
const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');
const { getText, jidNum, ownJid, sleep } = require('../lib/helpers');
const { applyVars } = require('./welcome');

async function goodbyeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'Cette commande ne fonctionne que dans les groupes.' }, { quoted: message });
        return;
    }
    const text = getText(message.message);
    const matchText = text.split(/\s+/).slice(1).join(' ');
    await handleGoodbye(sock, chatId, message, matchText);
}

const participantJid = (p) => (typeof p === 'string' ? p : (p?.id || p?.phoneNumber || ''));

function defaultGoodbye(vars) {
    return `╭━━━⊰👋⊱━━━╮\n   *AU REVOIR*\n╰━━━⊰👋⊱━━━╯\n\n${vars.user} a quitté *${vars.group}*.\n\n👥 Il reste *${vars.count}* membres.\n\nÀ bientôt peut-être ! 🥀\n\nCENTRAL-HEX`;
}

async function handleLeaveEvent(sock, id, participants) {
    // ✅ Rien n'est envoyé si "goodbye on" n'a pas été activé dans ce groupe.
    if (!(await isGoodByeOn(id))) return;

    const customMessage = await getGoodbye(id);
    let meta = null;
    try { meta = await sock.groupMetadata(id); } catch { /* le groupe peut ne plus être accessible */ }

    const bot = jidNum(ownJid(sock));
    const list = (participants || []).map(participantJid).filter((j) => j && jidNum(j) !== bot).slice(0, 15);

    for (const jid of list) {
        const vars = {
            user: '@' + jidNum(jid),
            group: meta?.subject || 'le groupe',
            description: meta?.desc || '',
            count: meta?.participants?.length ?? '?'
        };
        const text = customMessage ? applyVars(customMessage, vars) : defaultGoodbye(vars);
        try {
            await sock.sendMessage(id, { text, mentions: [jid], ...channelInfo });
        } catch (error) {
            console.error('Error sending goodbye message:', error.message);
        }
        if (list.length > 1) await sleep(800);
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
