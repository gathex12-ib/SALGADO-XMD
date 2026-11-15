// commands/help.js — guide général, ou explication détaillée d'une commande
const { CATEGORIES, COMMANDS, findCommand, suggest, ACCESS_LABEL } = require('../lib/commandInfo');
const { SYSTEM_NAME } = require('../lib/brand');

function buildGeneralHelp() {
    return `🥷 *SALGA-XMD — GUIDE D'UTILISATION*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✨ Ce bot fonctionne *sans préfixe* : écris simplement le nom de la commande.\n` +
        `Exemple : *ping*, *menu*, *image chat mignon*.\n\n` +
        `📚 *Pour commencer*\n` +
        `• *menu* → menu illustré\n` +
        `• *allmenu* → toutes les commandes (noms seulement)\n` +
        `• *help <commande>* → explication détaillée (ex : *help welcome*)\n\n` +
        `🗂️ *Catégories*\n${CATEGORIES.map((c) => `• ${c.title} (${COMMANDS.filter((x) => x.cat === c.id).length})`).join('\n')}\n\n` +
        `💡 *Astuces*\n` +
        `• Certaines commandes se tapent *en réponse* à un message : save, sticker, toimg, waouh, humm.\n` +
        `• Les commandes de groupe (kick, welcome, antilink…) demandent d'être *admin* ; le bot doit aussi être admin pour agir.\n` +
        `• *welcome* et *goodbye* sont désactivés tant que tu ne tapes pas *on*.\n` +
        `• Les commandes propriétaire (mode, antidelete, status) ne répondent qu'au propriétaire.\n\n` +
        `> _Propulsé par 🥷 *${SYSTEM_NAME}*_`;
}

function buildCommandHelp(cmd) {
    return `📖 *COMMANDE : ${cmd.name}*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 *Description*\n${cmd.desc}\n\n` +
        `⌨️ *Utilisation*\n${cmd.usage}\n` +
        (cmd.example ? `\n💡 *Exemple*\n${cmd.example}\n` : '') +
        (cmd.aliases.length ? `\n🔁 *Autres noms :* ${cmd.aliases.join(', ')}\n` : '') +
        `\n🔐 *Qui peut l'utiliser :* ${ACCESS_LABEL[cmd.access]}`;
}

async function helpCommand(sock, chatId, message, args) {
    const word = (args && args[0]) || '';
    let text;
    if (!word) {
        text = buildGeneralHelp();
    } else {
        const cmd = findCommand(word);
        if (cmd) text = buildCommandHelp(cmd);
        else {
            const s = suggest(word);
            text = `❌ La commande *${word}* n'existe pas.${s.length ? `\n\n💡 Tu voulais peut-être : ${s.map((x) => `*${x}*`).join(', ')}` : ''}\n\nTape *allmenu* pour voir toutes les commandes.`;
        }
    }
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = helpCommand;
module.exports.buildGeneralHelp = buildGeneralHelp;
module.exports.buildCommandHelp = buildCommandHelp;
