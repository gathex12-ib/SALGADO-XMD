const os = require('os');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { BOT_IMAGE } = require('../lib/brand');

const MODE_FILE = path.join(__dirname, '../data/messageCount.json');

function getMode() {
    try {
        const d = JSON.parse(fs.readFileSync(MODE_FILE));
        return d.isPublic === false ? 'private' : 'public';
    } catch {
        return 'public';
    }
}

function ramBar() {
    const pct = Math.min(100, Math.round((process.memoryUsage().rss / os.totalmem()) * 100));
    const totalBlocks = 5;
    const filled = Math.max(1, Math.round((pct / 100) * totalBlocks));
    return `${'■'.repeat(filled)}${'□'.repeat(totalBlocks - filled)} ${pct}%`;
}

function heure() {
    return new Date().toLocaleString('fr-FR', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

async function menuCommand(sock, chatId, message) {
    const mode = getMode();

    const caption = `👤 *${settings.creatorName}*
╔══════════════════🥷
║ ⿻ *ʙᴏᴛ ɴᴀᴍᴇ:* ${settings.botName}
║ ⿻ *ᴏᴡɴᴇʀ:* ${settings.botOwner}
║ ⿻ *ᴍᴏᴅᴇ:* ${mode}
║ ⿻ *ʜᴇᴜʀᴇ:* ${heure()}
║ ⿻ *ʀᴀᴍ:* ${ramBar()}
╚══════════════════🥷
╔═〔 🥷𝗦𝗔𝗟𝗚𝗔-𝗠𝗗 〕═❒
║╭─────────────◆
║│      『 𝗠𝗘𝗡𝗨-𝗕𝗢𝗧 』
║╰─────────────◆
╚══════════════════❒
║ ⬡ ➤ menu → Affiche ce menu
║ ⬡ ➤ allmenu → Toutes les commandes
║ ⬡ ➤ help <cmd> → Aide détaillée
║ ⬡ ➤ ping → Vitesse du bot
║ ⬡ ➤ info → Infos sur le bot
║ ⬡ ➤ owner → Propriétaires
║ ⬡ ➤ profile → Fiche d'un membre
║ ⬡ ➤ mode public/private
║ ⬡ ➤ pair <numéro> → Connexion
║ ⬡ ➤ tagall → Mentionner tous
║ ⬡ ➤ kick → Expulser un membre
║ ⬡ ➤ kickall → Expulser tous
║ ⬡ ➤ open / close → Ouvrir/fermer
║ ⬡ ➤ delete → Supprime des messages
║ ⬡ ➤ welcome on/off → Bienvenue
║ ⬡ ➤ goodbye on/off → Au revoir
║ ⬡ ➤ antilink / link → Bloque liens
║ ⬡ ➤ antibot → Bloque les bots
║ ⬡ ➤ antivv → Anti vue unique
║ ⬡ ➤ antidelete → Anti suppression
║ ⬡ ➤ sticker / s → Crée un sticker
║ ⬡ ➤ toimg → Sticker → image
║ ⬡ ➤ song <nom> → Musique
║ ⬡ ➤ image <mots> → Images Pinterest
║ ⬡ ➤ save → Sauvegarde un média
║ ⬡ ➤ waouh / humm → Vue unique
║ ⬡ ➤ status → Statuts WhatsApp
║ ⬡ ➤ gpt <question> → IA
╚══════════════════════🥷`;

    try {
        await sock.sendMessage(chatId, {
            image: { url: BOT_IMAGE },
            caption
        }, { quoted: message });
    } catch (e) {
        console.error('❌ [menu]', e.message);
        await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }
}

module.exports = menuCommand;
