const settings = require('../settings');
const { isSudo } = require('./index');

const num = (j) => String(j || '').split(':')[0].split('@')[0];

function ownerList() {
    const list = Array.isArray(settings.ownerNumbers) && settings.ownerNumbers.length
        ? settings.ownerNumbers
        : [settings.ownerNumber];
    return list.map((n) => String(n).replace(/[^0-9]/g, '')).filter(Boolean);
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const owners = ownerList();
    const senderClean = num(senderId);

    // 1. Le numéro de l'expéditeur est celui d'un propriétaire
    if (owners.includes(senderClean)) return true;

    // 2. Dans les groupes : WhatsApp peut masquer le numéro derrière un LID.
    //    On retrouve alors le participant dont le numéro (phoneNumber) est un propriétaire.
    if (sock && chatId && chatId.endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            for (const p of metadata?.participants || []) {
                const isOwnerParticipant = owners.includes(num(p.id)) || owners.includes(num(p.phoneNumber));
                if (!isOwnerParticipant) continue;
                if (p.id === senderId || p.lid === senderId || p.phoneNumber === senderId ||
                    num(p.id) === senderClean || num(p.lid) === senderClean || num(p.phoneNumber) === senderClean) {
                    return true;
                }
            }
        } catch (e) {
            console.error('❌ [isOwner] Erreur groupMetadata:', e.message);
        }
    }

    // 3. Utilisateurs sudo
    try {
        return !!(await isSudo(senderId));
    } catch (e) {
        return false;
    }
}

isOwnerOrSudo.ownerList = ownerList;
module.exports = isOwnerOrSudo;
