// commands/status.js — Téléchargeur de statuts WhatsApp (SALGA-XMD) — propriétaire uniquement
//
//  status                    → répondre à un statut : le télécharge ; sinon : liste des statuts reçus
//  status liste              → contacts qui ont des statuts (24 h)
//  status <n>                → tous les statuts du contact n° <n> de la liste
//  status <numéro>           → tous les statuts de ce numéro (ex : status 224621963059)
//  status tout               → tous les statuts mémorisés
//  status image|video|audio|texte [n]  → filtre par type
//  status auto on|off        → renvoie automatiquement chaque nouveau statut en privé
//  status vider              → efface la mémoire des statuts
const store = require('../lib/statusStore');
const {
    extractMedia, downloadMedia, buildMediaPayload, resolveDm, ownJid, getQuoted, digits, sleep
} = require('../lib/helpers');

const MAX_PER_REQUEST = 40;
const TYPE_WORDS = { image: 'image', images: 'image', photo: 'image', photos: 'image', video: 'video', videos: 'video', vidéo: 'video', vidéos: 'video', audio: 'audio', audios: 'audio', vocal: 'audio', texte: 'text', textes: 'text', text: 'text', txt: 'text' };
const TYPE_LABEL = { image: '🖼️ image', video: '🎬 vidéo', audio: '🎧 audio', text: '📝 texte' };

const fmtTime = (ts) => new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const label = (g) => `${g.name || 'Inconnu'}${g.num && !g.isLidOnly ? ` (+${g.num})` : ''}`;

/** Analyse les arguments de la commande. */
function parseArgs(args) {
    const out = { action: 'auto-detect', index: null, number: null, type: null, onoff: null };
    const words = args.map((a) => a.toLowerCase());
    const first = words[0] || '';
    if (['liste', 'list', 'ls', 'l'].includes(first)) out.action = 'list';
    else if (['tout', 'all', 'tous'].includes(first)) out.action = 'all';
    else if (['auto', 'automatique'].includes(first)) { out.action = 'auto'; out.onoff = words[1] || null; }
    else if (['vider', 'clear', 'reset', 'effacer'].includes(first)) out.action = 'clear';
    else if (['aide', 'help', '?'].includes(first)) out.action = 'help';
    else if (first && TYPE_WORDS[first]) { out.action = 'filter'; out.type = TYPE_WORDS[first]; }
    else if (/^\+?\d{1,3}$/.test(first) && words.length >= 1) { out.action = 'contact'; out.index = parseInt(first.replace('+', ''), 10); }
    else if (/^\+?\d{6,}$/.test(first.replace(/[\s-]/g, ''))) { out.action = 'contact'; out.number = digits(first); }
    else if (first) out.action = 'unknown';
    for (const w of words.slice(1)) {
        if (TYPE_WORDS[w]) out.type = TYPE_WORDS[w];
        else if (out.action === 'filter' && /^\d{1,3}$/.test(w)) { out.index = parseInt(w, 10); out.action = 'contact'; }
    }
    return out;
}

function helpText() {
    return `📥 *TÉLÉCHARGEUR DE STATUTS*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `• *status* (en réponse à un statut) → télécharge ce statut\n` +
        `• *status liste* → contacts qui ont un statut (24 h)\n` +
        `• *status 2* → tous les statuts du contact n°2\n` +
        `• *status 224621963059* → statuts d'un numéro\n` +
        `• *status tout* → tous les statuts mémorisés\n` +
        `• *status image* / *video* / *audio* / *texte* → filtrer par type (ex : *status 2 video*)\n` +
        `• *status auto on/off* → renvoi automatique de chaque nouveau statut\n` +
        `• *status vider* → effacer la mémoire\n\n` +
        `ℹ️ Seuls les statuts reçus *pendant que le bot est connecté* sont mémorisés (24 h). Tout est envoyé dans ton privé.`;
}

/** Envoie un statut (média ou texte) vers le JID demandé. */
async function sendItem(sock, to, it) {
    const head = `📥 *Statut* de ${it.name || 'Inconnu'}${it.num && !it.isLidOnly ? ` (+${it.num})` : ''}\n🕐 ${fmtTime(it.ts)}`;
    if (it.type === 'text') {
        await sock.sendMessage(to, { text: `${head}\n\n${it.caption || ''}` });
        return true;
    }
    const media = extractMedia(it.content);
    if (!media) return false;
    const buf = await downloadMedia(media);
    const caption = `${head}${it.caption ? `\n\n${it.caption}` : ''}`;
    await sock.sendMessage(to, buildMediaPayload(media, buf, caption));
    return true;
}

async function sendMany(sock, to, items) {
    let sent = 0, failed = 0;
    for (const it of items.slice(0, MAX_PER_REQUEST)) {
        try { (await sendItem(sock, to, it)) ? sent++ : failed++; } catch (e) { failed++; console.error('❌ [status] envoi:', e.message); }
        await sleep(700);
    }
    return { sent, failed, skipped: Math.max(0, items.length - MAX_PER_REQUEST) };
}

async function statusCommand(sock, chatId, senderId, message, args, isOwner) {
    // Discrétion : tout ce que le bot répond au propriétaire part dans son PRIVÉ, jamais dans la conversation
    // (sinon la personne dont on télécharge le statut verrait les messages du bot).
    if (!isOwner) return sock.sendMessage(chatId, { text: '❌ La commande *status* est réservée au propriétaire du bot.' }, { quoted: message });

    const dm = resolveDm(sock, message, senderId);
    const reply = (text) => sock.sendMessage(dm, { text });
    const p = parseArgs(args || []);
    const { quoted, ctx } = getQuoted(message);

    // 1) Réponse à un statut → on le télécharge directement
    const repliedToStatus = (ctx.remoteJid === 'status@broadcast' || (ctx.stanzaId && store.findById(sock, ctx.stanzaId))) && p.action === 'auto-detect';
    if (repliedToStatus) {
        const stored = ctx.stanzaId ? store.findById(sock, ctx.stanzaId) : null;
        let item = stored;
        if (!item && quoted) {
            const media = extractMedia(quoted);
            const txt = quoted.conversation || quoted.extendedTextMessage?.text || '';
            item = {
                id: ctx.stanzaId, poster: ctx.participant || '', num: digits(ctx.participant), isLidOnly: String(ctx.participant || '').endsWith('@lid'),
                name: '', type: media ? media.kind : 'text', caption: media ? media.caption : txt, ts: Date.now(), content: quoted
            };
            if (!media && !txt) item = null;
        }
        if (!item) return reply('❌ Impossible de lire ce statut (contenu indisponible).');
        try {
            await sendItem(sock, dm, item);   // succès : aucun message de confirmation
        } catch (e) {
            return reply(`❌ Téléchargement impossible (${e.message}). Le statut a peut-être expiré.`);
        }
        return;
    }

    if (p.action === 'help') return reply(helpText());

    if (p.action === 'auto') {
        if (p.onoff !== 'on' && p.onoff !== 'off') {
            const cur = store.getAuto(sock);
            return reply(`🤖 *Sauvegarde automatique des statuts :* ${cur.auto ? '🟢 Activée' : '🔴 Désactivée'}\n\nUtilise *status auto on* ou *status auto off*.`);
        }
        store.setAuto(sock, p.onoff === 'on', dm);
        return reply(p.onoff === 'on'
            ? '🟢 *Sauvegarde automatique activée.* Chaque nouveau statut reçu sera renvoyé dans ton privé.'
            : '🔴 *Sauvegarde automatique désactivée.*');
    }

    if (p.action === 'clear') {
        const n = store.clear(sock);
        return reply(`🗑️ ${n} statut(s) effacé(s) de la mémoire.`);
    }

    const groups = store.groupByContact(sock);

    if (p.action === 'unknown') return reply(`❌ Option inconnue.\n\n${helpText()}`);

    if (p.action === 'auto-detect' || p.action === 'list') {
        if (!groups.length) {
            return reply('📭 Aucun statut mémorisé pour le moment.\n\nLes statuts de tes contacts sont mémorisés dès qu\'ils sont publiés, tant que le bot est connecté.\nTape *status aide* pour voir toutes les options.');
        }
        const lines = groups.slice(0, 40).map((g, i) => {
            const types = ['image', 'video', 'audio', 'text'].map((t) => ({ t, n: g.items.filter((x) => x.type === t).length })).filter((x) => x.n).map((x) => `${x.n} ${TYPE_LABEL[x.t]}`).join(' · ');
            return `*${i + 1}.* ${label(g)} — ${types} _(dernier : ${fmtTime(g.items[g.items.length - 1].ts)})_`;
        }).join('\n');
        return reply(`📥 *STATUTS REÇUS (24 h)*\n━━━━━━━━━━━━━━━━━━━━\n${lines}\n\n👉 *status <n°>* pour télécharger ceux d'un contact\n👉 *status tout* pour tout télécharger`);
    }

    let items = [];
    if (p.action === 'all') items = groups.flatMap((g) => g.items);
    else if (p.action === 'filter') items = groups.flatMap((g) => g.items);
    else if (p.action === 'contact') {
        let g = null;
        if (p.number) g = groups.find((x) => x.num === p.number || x.num.endsWith(p.number));
        else g = groups[p.index - 1];
        if (!g) return reply('❌ Contact introuvable. Tape *status liste* pour voir la liste des numéros.');
        items = g.items;
    }
    if (p.type) items = items.filter((i) => i.type === p.type);
    items.sort((a, b) => a.ts - b.ts);

    if (!items.length) return reply('📭 Aucun statut correspondant.');
    const r = await sendMany(sock, dm, items);
    // Pas de confirmation quand tout s'est bien passé ; on ne signale que les problèmes.
    if (r.failed || r.skipped) {
        return reply(`⚠️ ${r.sent} statut(s) envoyé(s)${r.failed ? `, ${r.failed} échec(s) (expirés ?)` : ''}${r.skipped ? `, ${r.skipped} non envoyé(s) (limite de ${MAX_PER_REQUEST} par demande)` : ''}.`);
    }
}

/** Appelé pour chaque statut reçu : mémorise, et renvoie automatiquement si l'option est active. */
async function handleIncomingStatus(sock, message) {
    try {
        const item = store.add(sock, message);
        if (!item) return;
        const auto = store.getAuto(sock);
        if (auto.auto) {
            const target = auto.target || ownJid(sock);
            await sendItem(sock, target, item);
        }
    } catch (e) {
        console.error('❌ [status] capture:', e.message);
    }
}

module.exports = { statusCommand, handleIncomingStatus, parseArgs, sendItem };
