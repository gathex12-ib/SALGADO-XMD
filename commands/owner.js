const settings = require('../settings');
const { BOT_IMAGE, SYSTEM_NAME } = require('../lib/brand');

async function ownerCommand(sock, chatId, message) {
    const numbers = settings.ownerNumbers || [settings.ownerNumber];
    const names = settings.ownerNames || [];
    const owners = numbers.map((n, i) => ({
        number: n,
        name: names[i] || (i === 0 ? settings.creatorName : settings.botOwner)
    }));

    const lines = owners
        .map((o, i) => `│ ${i + 1}. 👤 *${o.name}*\n│    📞 +${o.number}`)
        .join('\n│\n');

    const caption = `┏━━━━━━━━━━━━━━━━━━━━━━┓
┃   🥷 *𝗦𝗔𝗟𝗚𝗔-𝗠𝗗* 🥷   ┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

👑 *PROPRIÉTAIRES DU BOT*
━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────
${lines}
└─────────────────────

🛠️ *Créé par :* ${settings.creatorName}

🏷️ *Dans le système :* 💎 *${SYSTEM_NAME}*

━━━━━━━━━━━━━━━━━━━━━━
🤖 *Bot     :* ${settings.botName}
📦 *Version :* v${settings.version}

📲 *Contacte-nous ci-dessous* 👇

> _Propulsé par 🥷 *${SYSTEM_NAME}*_`;

    try {
        await sock.sendMessage(chatId, { image: { url: BOT_IMAGE }, caption }, { quoted: message });
    } catch (e) {
        console.error('❌ [owner] image:', e.message);
        await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    }

    for (const o of owners) {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${o.name}\nTEL;waid=${o.number}:${o.number}\nEND:VCARD`;
        try {
            await sock.sendMessage(chatId, { contacts: { displayName: o.name, contacts: [{ vcard }] } });
        } catch (e) {
            console.error('❌ [owner] vcard:', e.message);
        }
    }
}

module.exports = ownerCommand;
