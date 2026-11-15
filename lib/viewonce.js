// lib/viewonce.js — récupération des médias "vue unique" (commandes humm / waouh)
// Discret : le résultat part UNIQUEMENT dans le privé de la personne qui tape la commande,
// jamais dans la conversation. Les erreurs aussi sont envoyées en privé.
const { getQuoted, extractMedia, downloadMedia, buildMediaPayload, resolveDm, KIND_LABEL } = require('./helpers');

async function retrieveViewOnce(sock, chatId, senderId, message, label) {
    const dm = resolveDm(sock, message, senderId);
    const tell = async (text) => { try { await sock.sendMessage(dm, { text }); } catch (e) { /* ignore */ } };

    const { quoted } = getQuoted(message);
    if (!quoted) {
        return tell(`ℹ️ *${label}* : réponds à un média *vue unique* avec *${label}*.`);
    }
    const media = extractMedia(quoted);
    if (!media) {
        return tell(`ℹ️ *${label}* : le message auquel tu réponds ne contient aucun média.`);
    }
    if (!media.viewOnce) {
        return tell(`ℹ️ Ce média n'est pas en *vue unique*. Pour sauvegarder un média normal, réponds-lui avec *save*.`);
    }
    try {
        const buf = await downloadMedia(media);
        const caption = `🥷 *SALGA-XMD* — vue unique récupérée (${label})${media.caption ? `\n\n${media.caption}` : ''}`;
        const payload = buildMediaPayload(media, buf, caption);
        await sock.sendMessage(dm, payload);
        if (media.kind === 'audio' || media.kind === 'sticker') {
            await sock.sendMessage(dm, { text: `🥷 *SALGA-XMD* — ${KIND_LABEL[media.kind]} vue unique récupéré (${label})` });
        }
    } catch (e) {
        console.error(`❌ [${label}]`, e.message);
        await tell(`❌ Impossible de récupérer ce média (${e.message}).\n_Il a peut-être expiré ou n'est plus disponible sur les serveurs WhatsApp._`);
    }
}

module.exports = { retrieveViewOnce };
