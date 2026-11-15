// commands/save.js — SALGA-XMD
// Réponds à un média (image, vidéo, audio, sticker, document) avec : save
// Le média est sauvegardé dans ta discussion privée avec le bot.
const { getQuoted, extractMedia, downloadMedia, buildMediaPayload, resolveDm, KIND_LABEL } = require('../lib/helpers');

async function saveCommand(sock, chatId, senderId, message) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const react = async (emoji) => { try { await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } }); } catch (e) { /* ignore */ } };

    const { quoted } = getQuoted(message);
    if (!quoted) return reply('📥 Réponds à un média (image, vidéo, audio, sticker, document) avec *save* pour le sauvegarder dans ton privé.');

    const media = extractMedia(quoted);
    if (!media) return reply('❌ Ce message ne contient pas de média. *save* fonctionne avec une image, une vidéo, un audio, un sticker ou un document.');

    const dm = resolveDm(sock, message, senderId);
    try {
        const buf = await downloadMedia(media);
        const caption = `📥 *Média sauvegardé* (${KIND_LABEL[media.kind]})${media.caption ? `\n\n${media.caption}` : ''}\n\n> 🥷 _SALGA-XMD_`;
        await sock.sendMessage(dm, buildMediaPayload(media, buf, caption));
        await react('✅');
        if (chatId.endsWith('@g.us') === false && dm !== chatId) await reply('✅ Sauvegardé dans ton privé.');
    } catch (e) {
        console.error('❌ [save]', e.message);
        await react('❌');
        await reply(`❌ Impossible de sauvegarder ce média (${e.message}).\n_Il a peut-être expiré._`);
    }
}

module.exports = saveCommand;
