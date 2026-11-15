// lib/welcome.js — réglage des messages de bienvenue / d'au revoir (SALGA-XMD)
// Règle : RIEN n'est actif par défaut. Le bot ne réagit à une arrivée / un départ
// que si un admin a tapé "welcome on" / "goodbye on" dans ce groupe.
const {
    isWelcomeOn, setWelcomeEnabled, setWelcomeMessage, delWelcome, getWelcome,
    isGoodByeOn, setGoodbyeEnabled, setGoodbyeMessage, delGoodBye, getGoodbye
} = require('./index');

const KINDS = {
    welcome: {
        title: '🎉 BIENVENUE', cmd: 'welcome',
        isOn: isWelcomeOn, setOn: setWelcomeEnabled, setMsg: setWelcomeMessage, reset: delWelcome, getMsg: getWelcome,
        vars: '• {user} → mentionne le membre\n• {group} → nom du groupe\n• {description} → description du groupe\n• {count} → nombre de membres',
        noun: 'arrive'
    },
    goodbye: {
        title: '👋 AU REVOIR', cmd: 'goodbye',
        isOn: isGoodByeOn, setOn: setGoodbyeEnabled, setMsg: setGoodbyeMessage, reset: delGoodBye, getMsg: getGoodbye,
        vars: '• {user} → le membre parti\n• {group} → nom du groupe\n• {count} → nombre de membres restants',
        noun: 'part'
    }
};

async function handleToggle(kind, sock, chatId, message, match) {
    const k = KINDS[kind];
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const [sub, ...rest] = (match || '').trim().split(/\s+/);
    const action = (sub || '').toLowerCase();
    const custom = rest.join(' ').trim();
    const on = await k.isOn(chatId);

    if (!action || action === 'status' || action === 'statut') {
        const current = await k.getMsg(chatId);
        return reply(
            `${k.title}\n━━━━━━━━━━━━━━━━━━━━\n📊 *Statut :* ${on ? '🟢 Activé' : '🔴 Désactivé'}\n` +
            `📝 *Message :* ${current ? 'personnalisé' : 'par défaut'}\n\n` +
            `📌 *Commandes :*\n• *${k.cmd} on* → activer\n• *${k.cmd} off* → désactiver\n• *${k.cmd} set <message>* → personnaliser\n• *${k.cmd} reset* → message par défaut\n\n` +
            `🔧 *Variables :*\n${k.vars}\n\n_Tant que ce n'est pas activé, le bot ne réagit pas quand un membre ${k.noun}._`
        );
    }
    if (action === 'on') {
        if (on) return reply(`⚠️ *${k.cmd}* est déjà activé dans ce groupe.`);
        await k.setOn(chatId, true);
        return reply(`✅ *${k.cmd}* activé. Le bot réagira désormais quand un membre ${k.noun}.\n_Personnalise-le avec *${k.cmd} set <message>*._`);
    }
    if (action === 'off') {
        if (!on) return reply(`⚠️ *${k.cmd}* est déjà désactivé dans ce groupe.`);
        await k.setOn(chatId, false);
        return reply(`✅ *${k.cmd}* désactivé. Le bot ne réagira plus quand un membre ${k.noun}.`);
    }
    if (action === 'set') {
        if (!custom) return reply(`⚠️ Écris ton message après *${k.cmd} set*.\nExemple : *${k.cmd} set Salut {user} dans {group} !*\n\n🔧 *Variables :*\n${k.vars}`);
        await k.setMsg(chatId, custom.slice(0, 1500));
        return reply(`✅ Message personnalisé enregistré.\n${on ? '' : `⚠️ *${k.cmd}* n'est pas encore activé : tape *${k.cmd} on* pour l'activer.`}`.trim());
    }
    if (action === 'reset') {
        await k.setMsg(chatId, null);
        return reply('♻️ Message remis par défaut.');
    }
    return reply(`❌ Option inconnue.\nUtilise : *${k.cmd} on* · *${k.cmd} off* · *${k.cmd} set <message>* · *${k.cmd} reset*`);
}

const handleWelcome = (sock, chatId, message, match) => handleToggle('welcome', sock, chatId, message, match);
const handleGoodbye = (sock, chatId, message, match) => handleToggle('goodbye', sock, chatId, message, match);

module.exports = { handleWelcome, handleGoodbye };
