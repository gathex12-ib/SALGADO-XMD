// lib/commandInfo.js — fiche de chaque commande (utilisée par "help" et "allmenu") — SALGA-XMD
// access : 'tous' | 'admins' | 'propriétaire'
const CATEGORIES = [
    { id: 'general', title: '🤖 GÉNÉRAL' },
    { id: 'groupe', title: '👥 GROUPE' },
    { id: 'protection', title: '🛡️ PROTECTION' },
    { id: 'medias', title: '🎨 MÉDIAS' },
    { id: 'ia', title: '🧠 INTELLIGENCE ARTIFICIELLE' }
];

const COMMANDS = [
    // ── Général
    { name: 'menu', aliases: ['bot'], cat: 'general', access: 'tous', usage: 'menu',
      desc: 'Affiche le menu illustré du bot avec toutes les commandes et leur rôle en une ligne.' },
    { name: 'allmenu', aliases: [], cat: 'general', access: 'tous', usage: 'allmenu',
      desc: 'Affiche la liste compacte de toutes les commandes, classées par catégorie (noms seulement).' },
    { name: 'help', aliases: ['aide'], cat: 'general', access: 'tous', usage: 'help  |  help <commande>', example: 'help welcome',
      desc: 'Sans nom : guide général du bot. Avec un nom de commande : explique en détail ce que fait cette commande.' },
    { name: 'ping', aliases: [], cat: 'general', access: 'tous', usage: 'ping',
      desc: 'Mesure la vitesse de réponse du bot.' },
    { name: 'info', aliases: [], cat: 'general', access: 'tous', usage: 'info',
      desc: 'Affiche les informations sur le bot (version, mémoire, durée de fonctionnement).' },
    { name: 'owner', aliases: [], cat: 'general', access: 'tous', usage: 'owner',
      desc: 'Affiche les propriétaires du bot et envoie leurs contacts.' },
    { name: 'mode', aliases: [], cat: 'general', access: 'propriétaire', usage: 'mode public  |  mode private', example: 'mode private',
      desc: 'Change le mode d\'accès : en « public » tout le monde utilise le bot, en « private » seul le propriétaire.' },
    { name: 'pair', aliases: [], cat: 'general', access: 'tous', usage: 'pair <numéro>', example: 'pair 224621963059',
      desc: 'Génère un code pour connecter un autre numéro WhatsApp au bot.' },
    { name: 'profile', aliases: ['profil'], cat: 'general', access: 'tous', usage: 'profile  |  profile @membre  |  profile <numéro>  (ou en réponse à un message)', example: 'profile @Awa',
      desc: 'Affiche la fiche d\'un membre : nom, numéro, statut, photo, et dans un groupe son rôle (admin/membre) et son nombre de messages. Sans précision, c\'est ton profil.' },

    // ── Groupe
    { name: 'tagall', aliases: [], cat: 'groupe', access: 'admins', usage: 'tagall [message]',
      desc: 'Mentionne tous les membres du groupe.' },
    { name: 'kick', aliases: [], cat: 'groupe', access: 'admins', usage: 'kick @membre',
      desc: 'Expulse le ou les membres mentionnés (le bot doit être admin).' },
    { name: 'kickall', aliases: [], cat: 'groupe', access: 'admins', usage: 'kickall',
      desc: 'Expulse tous les membres non-admins du groupe (le bot doit être admin).' },
    { name: 'open', aliases: [], cat: 'groupe', access: 'admins', usage: 'open',
      desc: 'Ouvre le groupe : tout le monde peut écrire.' },
    { name: 'close', aliases: [], cat: 'groupe', access: 'admins', usage: 'close',
      desc: 'Ferme le groupe : seuls les admins peuvent écrire.' },
    { name: 'delete', aliases: ['del'], cat: 'groupe', access: 'admins', usage: 'delete <nombre>  |  delete (en réponse)', example: 'delete 5',
      desc: 'Supprime des messages récents du groupe (les derniers, ou ceux d\'un membre).' },
    { name: 'welcome', aliases: [], cat: 'groupe', access: 'admins', usage: 'welcome on | off | set <message> | reset', example: 'welcome set Bienvenue {user} dans {group} !',
      desc: 'Message de bienvenue des nouveaux membres. Désactivé par défaut : le bot ne réagit que si tu as tapé « welcome on » dans le groupe. Variables : {user} {group} {description} {count}.' },
    { name: 'goodbye', aliases: [], cat: 'groupe', access: 'admins', usage: 'goodbye on | off | set <message> | reset', example: 'goodbye set Au revoir {user} !',
      desc: 'Message d\'au revoir quand un membre quitte le groupe. Désactivé par défaut : le bot ne réagit que si tu as tapé « goodbye on » dans le groupe. Variables : {user} {group} {count}.' },

    // ── Protection
    { name: 'antilink', aliases: [], cat: 'protection', access: 'admins', usage: 'antilink on | off',
      desc: 'Supprime automatiquement les liens envoyés dans le groupe.' },
    { name: 'link', aliases: [], cat: 'protection', access: 'admins', usage: 'link on | off',
      desc: 'Alternative rapide pour bloquer les liens dans le groupe.' },
    { name: 'antibot', aliases: [], cat: 'protection', access: 'admins', usage: 'antibot on | off',
      desc: 'Ignore les messages envoyés par d\'autres bots dans le groupe.' },
    { name: 'antivv', aliases: [], cat: 'protection', access: 'tous', usage: 'antivv on | off',
      desc: 'Récupère automatiquement les médias « vue unique » du chat et les envoie au propriétaire.' },
    { name: 'antidelete', aliases: [], cat: 'protection', access: 'propriétaire', usage: 'antidelete on | off',
      desc: 'Quand quelqu\'un supprime un message (groupe ou privé), le bot t\'envoie en privé un rapport avec le message supprimé (texte, image, vidéo, audio, sticker, document). Les médias « vue unique » sont aussi récupérés. Réservé au propriétaire.' },

    // ── Médias
    { name: 'sticker', aliases: ['s'], cat: 'medias', access: 'tous', usage: 'sticker (en réponse à une image/vidéo)',
      desc: 'Transforme une image ou une courte vidéo en sticker.' },
    { name: 'toimg', aliases: ['toimage'], cat: 'medias', access: 'tous', usage: 'toimg (en réponse à un sticker)',
      desc: 'Transforme un sticker en image.' },
    { name: 'song', aliases: ['play', 'mp3', 'ytmp3'], cat: 'medias', access: 'tous', usage: 'song <titre>', example: 'song Burna Boy Last Last',
      desc: 'Cherche une musique sur YouTube et l\'envoie en audio.' },
    { name: 'image', aliases: ['img', 'pinterest'], cat: 'medias', access: 'tous', usage: 'image <recherche> [nombre]', example: 'image paysage montagne 8',
      desc: 'Cherche des images sur le web (Pinterest) et en envoie jusqu\'à 10.' },
    { name: 'save', aliases: [], cat: 'medias', access: 'tous', usage: 'save (en réponse à un média)',
      desc: 'Sauvegarde un média (image, vidéo, audio, sticker, document) dans ta discussion privée. Réponds au média concerné.' },
    { name: 'waouh', aliases: [], cat: 'medias', access: 'tous', usage: 'waouh (en réponse à un média vue unique)',
      desc: 'Récupère un média « vue unique » et te l\'envoie en privé, discrètement (rien n\'apparaît dans la conversation).' },
    { name: 'humm', aliases: [], cat: 'medias', access: 'tous', usage: 'humm (en réponse à un média vue unique)',
      desc: 'Comme waouh : récupère un média « vue unique » et te l\'envoie en privé, discrètement.' },
    { name: 'status', aliases: ['statut', 'statuts', 'dlstatus'], cat: 'medias', access: 'propriétaire', usage: 'status liste | status <n°> | status tout | status auto on/off | status vider', example: 'status 2 video',
      desc: 'Télécharge les statuts WhatsApp : en réponse à un statut, par contact, par numéro, tous d\'un coup, filtrés par type (image/video/audio/texte), ou automatiquement avec « status auto on ». Envoyé dans ton privé. Réservé au propriétaire.' },

    // ── IA
    { name: 'gpt', aliases: ['ai'], cat: 'ia', access: 'tous', usage: 'gpt <question>', example: 'gpt explique-moi la blockchain',
      desc: 'Pose une question à l\'intelligence artificielle.' }
];

const byName = new Map();
for (const c of COMMANDS) {
    byName.set(c.name, c);
    for (const a of c.aliases) byName.set(a, c);
}

function findCommand(word) {
    return byName.get(String(word || '').toLowerCase().replace(/^[.!\/#]+/, '')) || null;
}

function suggest(word) {
    const w = String(word || '').toLowerCase();
    if (!w) return [];
    return [...byName.keys()].filter((k) => k.startsWith(w[0]) && (k.includes(w) || w.includes(k) || k.startsWith(w.slice(0, 2)))).slice(0, 4);
}

const ACCESS_LABEL = { tous: '👥 Tout le monde', admins: '🛡️ Admins du groupe (et propriétaire)', 'propriétaire': '👑 Propriétaire uniquement' };

module.exports = { CATEGORIES, COMMANDS, findCommand, suggest, ACCESS_LABEL };
