// commands/welcome.js — "welcome on/off/set/reset" + message d'arrivée (SALGA-XMD)
// ⚠️ Le message de bienvenue n'est envoyé QUE si "welcome on" a été tapé dans le groupe.
const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');
const store = require('../lib/lightweight_store');
const { getText, jidNum, ownJid, sleep } = require('../lib/helpers');

async function welcomeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'Cette commande ne fonctionne que dans les groupes.' }, { quoted: message });
        return;
    }
    const text = getText(message.message);
    const matchText = text.split(/\s+/).slice(1).join(' ');
    await handleWelcome(sock, chatId, message, matchText);
}

const participantJid = (p) => (typeof p === 'string' ? p : (p?.id || p?.phoneNumber || ''));

function applyVars(template, vars) {
    return template
        .replace(/@?\{user\}/g, vars.user)
        .replace(/\{group\}/g, vars.group)
        .replace(/\{description\}/g, vars.description)
        .replace(/\{count\}/g, String(vars.count));
}

function defaultWelcome(vars) {
    return `╭━━━⊰🎉⊱━━━╮\n   *BIENVENUE !*\n╰━━━⊰🎉⊱━━━╯\n\nSalut ${vars.user} 👋\n\nOn est super content de t'accueillir dans *${vars.group}* ! 🥳\n\n📋 *À propos du groupe :*\n${vars.description}\n\n👥 Nous sommes maintenant *${vars.count}* membres.\n\nN'hésite pas à te présenter avec une photo de toi 📸\n\n❥ Prénom : \n❥ Nom : \n❥ Âge : \n❥ Situation : \n❥ Niveau : \n❥ Boulot : \n\nCENTRAL-HEX`;
}

async function handleJoinEvent(sock, id, participants) {
    // ✅ Rien n'est envoyé si "welcome on" n'a pas été activé dans ce groupe.
    if (!(await isWelcomeOn(id))) return;

    const customMessage = await getWelcome(id);
    let meta;
    try { meta = await sock.groupMetadata(id); } catch { return; }

    const bot = jidNum(ownJid(sock));
    const list = (participants || []).map(participantJid).filter((j) => j && jidNum(j) !== bot).slice(0, 15);

    for (const jid of list) {
        const vars = {
            user: '@' + jidNum(jid),
            group: meta.subject || 'le groupe',
            description: meta.desc || 'Aucune description',
            count: meta.participants?.length ?? '?'
        };
        const text = customMessage ? applyVars(customMessage, vars) : defaultWelcome(vars);
        try {
            let pic = null;
            try { pic = await sock.profilePictureUrl(jid, 'image'); } catch { /* pas de photo publique */ }
            if (pic) await sock.sendMessage(id, { image: { url: pic }, caption: text, mentions: [jid], ...channelInfo });
            else await sock.sendMessage(id, { text, mentions: [jid], ...channelInfo });
        } catch (error) {
            console.error('Error sending welcome message:', error.message);
            try { await sock.sendMessage(id, { text, mentions: [jid] }); } catch (e2) { /* ignore */ }
        }
        if (list.length > 1) await sleep(800);
    }
}

module.exports = { welcomeCommand, handleJoinEvent, applyVars };
