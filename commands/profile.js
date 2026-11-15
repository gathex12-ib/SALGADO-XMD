// commands/profile.js — SALGA-XMD
// Fiche d'un membre : nom, numéro, statut, photo ; dans un groupe : rôle et nombre de messages.
// Sans précision, c'est ton propre profil. Cible : @mention, réponse à un message, ou numéro.
const store = require('../lib/lightweight_store');
const counter = require('../lib/counter');
const { getQuoted, digits, jidNum, ownJid } = require('../lib/helpers');

async function profileCommand(sock, chatId, senderId, message, args) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const isGroup = chatId.endsWith('@g.us');
    const { ctx } = getQuoted(message);

    // 1) Qui est visé ?
    let targetId = null;
    if (ctx.mentionedJid && ctx.mentionedJid.length) targetId = ctx.mentionedJid[0];
    else if (ctx.participant && ctx.quotedMessage) targetId = ctx.participant;
    else {
        const num = digits((args || []).join(''));
        if (num.length >= 6) targetId = `${num}@s.whatsapp.net`;
    }
    const isSelf = !targetId;
    if (isSelf) targetId = message.key.fromMe ? ownJid(sock) : senderId;

    // 2) Participant du groupe correspondant (gère numéro et LID)
    let participant = null;
    let meta = null;
    if (isGroup) {
        try {
            meta = await sock.groupMetadata(chatId);
            const t = digits(targetId);
            participant = (meta.participants || []).find((p) =>
                p.id === targetId || p.lid === targetId || p.phoneNumber === targetId ||
                digits(p.id) === t || digits(p.lid) === t || digits(p.phoneNumber) === t) || null;
        } catch { /* groupe indisponible */ }
    }
    if (!isSelf && isGroup && !participant && meta) return reply('❌ Cette personne ne fait pas partie de ce groupe.');

    // 3) Identité
    const ids = [targetId, participant?.id, participant?.lid, participant?.phoneNumber].filter(Boolean);
    const pnJid = ids.find((j) => String(j).endsWith('@s.whatsapp.net')) || targetId;
    const hasPn = String(pnJid).endsWith('@s.whatsapp.net');
    const contact = ids.map((j) => store.contacts?.[j]).find((c) => c?.name);
    const selfName = isSelf && message.pushName ? message.pushName : '';
    const name = participant?.name || participant?.notify || contact?.name || selfName || (digits(pnJid) ? `+${digits(pnJid)}` : 'Inconnu');

    // 4) Statut (bio) et photo
    let bio = 'Non disponible';
    try {
        const res = await sock.fetchStatus(pnJid);
        const entry = Array.isArray(res) ? res[0] : res;
        const text = entry?.status?.status ?? entry?.status;
        if (typeof text === 'string' && text.trim()) bio = text.trim();
        else if (typeof text === 'string') bio = 'Aucun statut';
    } catch { /* confidentialité du contact */ }

    let pic = null;
    try { pic = await sock.profilePictureUrl(pnJid, 'image'); } catch { /* pas de photo visible */ }

    // 5) Groupe : rôle + messages
    let groupLines = '';
    if (isGroup && participant) {
        const role = participant.admin === 'superadmin' ? '👑 Créateur du groupe' : participant.admin === 'admin' ? '🛡️ Admin' : '👤 Membre';
        const total = counter.getCount(chatId, ...ids);
        groupLines = `\n🏷️ *Rôle :* ${role}\n💬 *Messages :* ${total} (dans ce groupe, depuis que le bot les compte)`;
    }

    const caption =
        `👤 *PROFIL*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `📛 *Nom :* ${name}\n` +
        `📞 *Numéro :* ${hasPn ? '+' + digits(pnJid) : 'masqué par WhatsApp'}\n` +
        `📝 *Statut :* ${bio}` +
        `${groupLines}\n\n> 🥷 _SALGA-XMD_`;

    try {
        if (pic) await sock.sendMessage(chatId, { image: { url: pic }, caption, mentions: [targetId] }, { quoted: message });
        else await sock.sendMessage(chatId, { text: caption + '\n🖼️ _Aucune photo de profil visible_', mentions: [targetId] }, { quoted: message });
    } catch (e) {
        console.error('❌ [profile]', e.message);
        await reply(caption);
    }
}

module.exports = profileCommand;
