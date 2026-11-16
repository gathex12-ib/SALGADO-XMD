// commands/capture.js — save / humm / waouh (SALGA-XMD)
//
//  save   : répondre à un média (image, vidéo, vocal/audio, sticker, document) → il part dans ton PRIVÉ
//  humm / waouh : même chose, pour les médias « vue unique »
//  Sans répondre à rien : la commande prend le DERNIER média reçu dans la discussion.
//
// Silencieux : rien n'apparaît dans la conversation (ni réaction, ni confirmation).
// Les erreurs te sont aussi envoyées en privé.
const { buildMediaPayload, resolveDm, KIND_LABEL } = require('../lib/helpers');
const vault = require('../lib/vault');

async function captureCommand(sock, chatId, senderId, message, label) {
    const dm = resolveDm(sock, message, senderId);
    const tell = async (text) => { try { await sock.sendMessage(dm, { text }); } catch (e) { /* ignore */ } };
    const isSave = label === 'save';

    try {
        const { media, buf } = await vault.resolveForCommand(sock, message, { preferViewOnce: !isSave });
        const head = isSave
            ? `📥 *Média sauvegardé* (${KIND_LABEL[media.kind]})`
            : `🥷 *SALGA-XMD* — ${media.viewOnce ? 'vue unique récupérée' : 'média récupéré'} (${label})`;
        const caption = `${head}${media.caption ? `\n\n${media.caption}` : ''}\n\n> 🥷 _SALGA-XMD_`;
        await sock.sendMessage(dm, buildMediaPayload(media, buf, caption));
        if (media.kind === 'audio' || media.kind === 'sticker') await tell(head);
    } catch (e) {
        if (e.code === 'NO_QUOTE') {
            return tell(isSave
                ? '📥 *save* : réponds à un média avec *save* (ou tape *save* juste après avoir reçu un média).'
                : `ℹ️ *${label}* : réponds à une vue unique avec *${label}* (ou tape *${label}* juste après l'avoir reçue).`);
        }
        if (e.code === 'NO_MEDIA') return tell(`ℹ️ *${label}* : le message auquel tu réponds ne contient aucun média.`);
        console.error(`❌ [${label}]`, e.message);
        const tip = isSave ? '' : `\n\n💡 Vue unique : réponds-lui avec *${label}* dès qu'elle arrive, *avant de l'ouvrir* sur ton téléphone.`;
        await tell(`❌ Impossible de récupérer ce média.\n${e.message}${tip}${e.diag ? `\n\n🔧 ${e.diag}` : ''}`);
    }
}

module.exports = { captureCommand };
