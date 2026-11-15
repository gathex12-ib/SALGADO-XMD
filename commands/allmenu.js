// commands/allmenu.js — liste compacte de toutes les commandes par catégorie (noms seulement)
const { CATEGORIES, COMMANDS } = require('../lib/commandInfo');
const { SYSTEM_NAME } = require('../lib/brand');

function buildAllMenu() {
    const blocks = CATEGORIES.map((cat) => {
        const names = COMMANDS.filter((c) => c.cat === cat.id).map((c) => c.name).join(' · ');
        return `${cat.title}\n${names}`;
    });
    return `🥷 *SALGA-XMD — TOUTES LES COMMANDES*\n━━━━━━━━━━━━━━━━━━━━\n\n${blocks.join('\n\n')}\n\n━━━━━━━━━━━━━━━━━━━━\n📌 ${COMMANDS.length} commandes · *help <commande>* pour le détail · *menu* pour le menu illustré\n\n> _Propulsé par 🥷 *${SYSTEM_NAME}*_`;
}

async function allmenuCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: buildAllMenu() }, { quoted: message });
}

module.exports = allmenuCommand;
module.exports.buildAllMenu = buildAllMenu;
