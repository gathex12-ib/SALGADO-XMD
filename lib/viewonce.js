// lib/viewonce.js — récupération des médias "vue unique" (commandes humm / waouh)
// Discret : le résultat part UNIQUEMENT dans le privé de la personne qui tape la commande,
// jamais dans la conversation. Les erreurs aussi sont envoyées en privé.
const { buildMediaPayload, resolveDm, KIND_LABEL } = require('./helpers');
const { resolveQuotedMedia } = require('./mediaCache');

async function retrieveViewOnce(sock, chatId, senderId, message, label) {
    const dm = resolveDm(sock, message, senderId);
    const tell = async (text) => { try { await sock.sendMessage(dm, { text }); } catch (e) { /* ignore */ } };

    try {
        const { media, buf } = await resolveQuotedMedia(sock, message);
        if (!media.viewOnce) {
            return tell("ℹ️ Ce média n'est pas en *vue unique*. Pour sauvegarder un média normal, réponds-lui avec *save*.");
        }
        const caption = `🥷 *SALGA-XMD* — vue unique récupérée (${label})${media.caption ? `\n\n${media.caption}` : ''}`;
        await sock.sendMessage(dm, buildMediaPayload(media, buf, caption));
        if (media.kind === 'audio' || media.kind === 'sticker') {
            await sock.sendMessage(dm, { text: `🥷 *SALGA-XMD* — ${KIND_LABEL[media.kind]} vue unique récupéré (${label})` });
        }
    } catch (e) {
        if (e.code === 'NO_QUOTE') return tell(`ℹ️ *${label}* : réponds à un média *vue unique* avec *${label}*.`);
        if (e.code === 'NO_MEDIA') return tell(`ℹ️ *${label}* : le message auquel tu réponds ne contient aucun média.`);
        console.error(`❌ [${label}]`, e.message);
        await tell(`❌ Impossible de récupérer ce média.\n${e.message}`);
    }
}

module.exports = { retrieveViewOnce };
