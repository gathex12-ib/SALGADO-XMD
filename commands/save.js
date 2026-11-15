// commands/save.js — SALGA-XMD
// Réponds à un média (image, vidéo, audio, sticker, document) avec : save
// Le média est sauvegardé dans ta discussion privée avec le bot. Rien n'apparaît dans la conversation.
const { buildMediaPayload, resolveDm, KIND_LABEL } = require('../lib/helpers');
const { resolveQuotedMedia } = require('../lib/mediaCache');

async function saveCommand(sock, chatId, senderId, message) {
    const dm = resolveDm(sock, message, senderId);
    const tell = async (text) => { try { await sock.sendMessage(dm, { text }); } catch (e) { /* ignore */ } };

    try {
        const { media, buf } = await resolveQuotedMedia(sock, message);
        const caption = `📥 *Média sauvegardé* (${KIND_LABEL[media.kind]})${media.caption ? `\n\n${media.caption}` : ''}\n\n> 🥷 _SALGA-XMD_`;
        await sock.sendMessage(dm, buildMediaPayload(media, buf, caption));
    } catch (e) {
        if (e.code === 'NO_QUOTE') return tell('📥 *save* : réponds à un média (image, vidéo, audio, sticker, document) avec *save* pour le sauvegarder ici.');
        if (e.code === 'NO_MEDIA') return tell('❌ *save* : ce message ne contient pas de média (image, vidéo, audio, sticker ou document).');
        console.error('❌ [save]', e.message);
        await tell(`❌ Impossible de sauvegarder ce média.\n${e.message}`);
    }
}

module.exports = saveCommand;
