// lib/viewonce.js — humm / waouh (SALGA-XMD)
// Réponds à un média (de préférence « vue unique ») avec humm ou waouh : il t'est envoyé dans ton PRIVÉ.
// Totalement silencieux dans la conversation : pas de réaction, pas de message de confirmation.
// Tolérant : même si WhatsApp a « perdu » l'indicateur vue unique dans la copie citée, le média est récupéré.
const { buildMediaPayload, resolveDm, KIND_LABEL } = require('./helpers');
const { resolveQuotedMedia } = require('./mediaCache');

async function retrieveViewOnce(sock, chatId, senderId, message, label) {
    const dm = resolveDm(sock, message, senderId);
    const tell = async (text) => { try { await sock.sendMessage(dm, { text }); } catch (e) { /* ignore */ } };

    try {
        const { media, buf } = await resolveQuotedMedia(sock, message);
        const what = media.viewOnce ? 'vue unique récupérée' : 'média récupéré';
        const caption = `🥷 *SALGA-XMD* — ${what} (${label})${media.caption ? `\n\n${media.caption}` : ''}`;
        await sock.sendMessage(dm, buildMediaPayload(media, buf, caption));
        if (media.kind === 'audio' || media.kind === 'sticker') {
            await sock.sendMessage(dm, { text: `🥷 *SALGA-XMD* — ${KIND_LABEL[media.kind]} ${media.viewOnce ? 'vue unique ' : ''}récupéré (${label})` });
        }
    } catch (e) {
        if (e.code === 'NO_QUOTE') return tell(`ℹ️ *${label}* : réponds à un média *vue unique* avec *${label}*.`);
        if (e.code === 'NO_MEDIA') return tell(`ℹ️ *${label}* : le message auquel tu réponds ne contient aucun média.`);
        console.error(`❌ [${label}]`, e.message);
        await tell(`❌ Impossible de récupérer ce média.\n${e.message}`);
    }
}

module.exports = { retrieveViewOnce };
