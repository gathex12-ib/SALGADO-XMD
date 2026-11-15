const { test } = require('node:test');
const assert = require('node:assert');
const { load, makeSock, makeMsg, texts, TMP } = require('./_env');

const main = load('main.js');
const settings = load('settings.js');
const GROUP = '120363000000000000@g.us';
const ADMIN = '224700000001@s.whatsapp.net';
const MEMBER = '224700000002@s.whatsapp.net';
const run = (sock, m) => main.handleMessages(sock, { type: 'notify', messages: [m] });
const say = (sock, text, o = {}) => run(sock, makeMsg({ text, ...o }));

// ───────────────────────── 1. Propriétaires
test('owner : les deux nouveaux numéros, plus l\'ancien', async () => {
    assert.deepEqual(settings.ownerNumbers, ['224621963059', '224663109041']);
    const sock = makeSock();
    await say(sock, 'owner');
    const all = JSON.stringify(sock.sent);
    assert.ok(all.includes('224621963059') && all.includes('224663109041'));
    assert.ok(!all.includes('224662675862'), 'ancien numéro encore présent');
    assert.equal(sock.sent.filter((s) => s.content.contacts).length, 2);
});

test('isOwnerOrSudo reconnaît les deux propriétaires (numéro et LID de groupe)', async () => {
    const isOwner = load('lib/isOwner.js');
    assert.equal(await isOwner('224621963059@s.whatsapp.net'), true);
    assert.equal(await isOwner('224663109041@s.whatsapp.net'), true);
    assert.equal(await isOwner('224662675862@s.whatsapp.net'), false);
    assert.equal(await isOwner('224999999999@s.whatsapp.net'), false);
    const sock = makeSock({ meta: { participants: [{ id: '999@lid', lid: '999@lid', phoneNumber: '224663109041@s.whatsapp.net' }] } });
    assert.equal(await isOwner('999@lid', sock, GROUP), true);
});

// ───────────────────────── 2. Welcome / goodbye
test('welcome : RIEN d\'envoyé tant que "welcome on" n\'a pas été tapé', async () => {
    const sock = makeSock();
    await main.handleGroupParticipantUpdate(sock, { id: GROUP, action: 'add', participants: [MEMBER] });
    assert.equal(sock.sent.length, 0, 'bienvenue envoyée alors que non activée');
});

test('welcome : réservé aux admins, on → message, off → silence', async () => {
    const sock = makeSock();
    await say(sock, 'welcome on', { from: MEMBER });                       // simple membre
    assert.match(texts(sock), /Réservé aux admins/);
    sock.sent.length = 0;

    await say(sock, 'welcome on', { from: ADMIN });
    assert.match(texts(sock), /activé/);
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: GROUP, action: 'add', participants: [{ id: MEMBER }] });
    assert.equal(sock.sent.length, 1);
    assert.match(sock.sent[0].content.text || sock.sent[0].content.caption, /BIENVENUE/);
    assert.deepEqual(sock.sent[0].content.mentions, [MEMBER]);

    sock.sent.length = 0;
    await say(sock, 'welcome off', { from: ADMIN });
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: GROUP, action: 'add', participants: [MEMBER] });
    assert.equal(sock.sent.length, 0, 'bienvenue envoyée après welcome off');
});

test('welcome set : enregistre le message SANS activer', async () => {
    const sock = makeSock();
    const G2 = '120363111111111111@g.us';
    await say(sock, 'welcome set Salut {user} dans {group} ({count}) !', { from: ADMIN, group: G2 });
    assert.match(texts(sock), /n'est pas encore activé/);
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: G2, action: 'add', participants: [MEMBER] });
    assert.equal(sock.sent.length, 0);
    await say(sock, 'welcome on', { from: ADMIN, group: G2 });
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: G2, action: 'add', participants: [MEMBER] });
    assert.equal(sock.sent[0].content.text || sock.sent[0].content.caption, 'Salut @224700000002 dans Groupe Test (3) !');
});

test('goodbye : silencieux par défaut, actif après "goodbye on", silencieux après off', async () => {
    const sock = makeSock();
    const G3 = '120363222222222222@g.us';
    await main.handleGroupParticipantUpdate(sock, { id: G3, action: 'remove', participants: [MEMBER] });
    assert.equal(sock.sent.length, 0);
    await say(sock, 'goodbye on', { from: ADMIN, group: G3 });
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: G3, action: 'remove', participants: [MEMBER] });
    assert.equal(sock.sent.length, 1);
    assert.match(sock.sent[0].content.text, /AU REVOIR/);
    await say(sock, 'goodbye off', { from: ADMIN, group: G3 });
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: G3, action: 'remove', participants: [MEMBER] });
    assert.equal(sock.sent.length, 0);
});

test('welcome/goodbye : le bot ne se souhaite pas la bienvenue à lui-même', async () => {
    const sock = makeSock();
    const G4 = '120363333333333333@g.us';
    await say(sock, 'welcome on', { from: ADMIN, group: G4 });
    sock.sent.length = 0;
    await main.handleGroupParticipantUpdate(sock, { id: G4, action: 'add', participants: ['224600000000@s.whatsapp.net'] });
    assert.equal(sock.sent.length, 0);
});

// ───────────────────────── 3. help / allmenu
test('allmenu : liste compacte, contient toutes les commandes', async () => {
    const { COMMANDS } = load('lib/commandInfo.js');
    const sock = makeSock();
    await say(sock, 'allmenu');
    const t = texts(sock);
    for (const c of COMMANDS) assert.ok(t.includes(c.name), 'manque ' + c.name);
    assert.ok(!t.includes('Description'));
});

test('chaque commande du switch de main.js a une fiche help', () => {
    const fs = require('fs');
    const { findCommand } = load('lib/commandInfo.js');
    const src = fs.readFileSync(TMP + '/main.js', 'utf8');
    const cases = [...src.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
    for (const c of cases) assert.ok(findCommand(c), 'pas de fiche pour : ' + c);
});

test('help sans nom = guide général ; avec nom = détail ; inconnu = suggestion', async () => {
    const sock = makeSock();
    await say(sock, 'help');
    assert.match(texts(sock), /GUIDE D'UTILISATION/);
    sock.sent.length = 0;
    await say(sock, 'help antidelete');
    assert.match(texts(sock), /rapport avec le message supprimé/);
    assert.match(texts(sock), /Propriétaire uniquement/);
    sock.sent.length = 0;
    await say(sock, 'help statut');   // alias
    assert.match(texts(sock), /COMMANDE : status/);
    sock.sent.length = 0;
    await say(sock, 'help zzz');
    assert.match(texts(sock), /n'existe pas/);
});

test('un préfixe toléré : ".menu" fonctionne', async () => {
    const sock = makeSock();
    await say(sock, '.allmenu');
    assert.match(texts(sock), /TOUTES LES COMMANDES/);
});

// ───────────────────────── 4. save / humm / waouh
const viewOnceImage = { viewOnceMessageV2: { message: { imageMessage: { mimetype: 'image/jpeg', viewOnce: true, caption: 'secret', __data: 'IMG' } } } };
const normalImage = { imageMessage: { mimetype: 'image/jpeg', caption: 'photo', __data: 'NORMAL' } };

for (const name of ['humm', 'waouh']) {
    test(`${name} : vue unique → envoyé en privé uniquement, rien dans le groupe`, async () => {
        const sock = makeSock();
        await say(sock, name, { from: MEMBER, quoted: viewOnceImage });
        assert.equal(sock.sent.length, 1);
        assert.equal(sock.sent[0].jid, MEMBER);
        assert.ok(Buffer.isBuffer(sock.sent[0].content.image));
        assert.equal(sock.sent[0].jid.endsWith('@g.us'), false);
    });
    test(`${name} : depuis le compte du bot → écrit dans son propre chat`, async () => {
        const sock = makeSock();
        await say(sock, name, { from: '224600000000@s.whatsapp.net', fromMe: true, quoted: viewOnceImage });
        assert.equal(sock.sent[0].jid, '224600000000@s.whatsapp.net');
    });
    test(`${name} : média normal ou média expiré → message d'aide en privé, jamais de silence`, async () => {
        const sock = makeSock();
        await say(sock, name, { from: MEMBER, quoted: normalImage });
        assert.match(sock.sent[0].content.text, /pas en \*vue unique\*/);
        assert.equal(sock.sent[0].jid, MEMBER);
        sock.sent.length = 0;
        await say(sock, name, { from: MEMBER, quoted: { viewOnceMessageV2: { message: { videoMessage: { viewOnce: true, __fail: true } } } } });
        assert.match(sock.sent[0].content.text, /Impossible de récupérer/);
    });
}

test('save : image, vidéo, audio, sticker, document → privé, au bon format', async () => {
    const cases = [
        [{ imageMessage: { mimetype: 'image/png', caption: 'c', __data: 'a' } }, 'image'],
        [{ videoMessage: { mimetype: 'video/mp4', __data: 'v' } }, 'video'],
        [{ audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true, __data: 'au' } }, 'audio'],
        [{ stickerMessage: { __data: 's' } }, 'sticker'],
        [{ documentMessage: { mimetype: 'application/pdf', fileName: 'cv.pdf', __data: 'd' } }, 'document'],
        [{ ephemeralMessage: { message: { imageMessage: { __data: 'e' } } } }, 'image']
    ];
    for (const [q, kind] of cases) {
        const sock = makeSock();
        await say(sock, 'save', { from: MEMBER, quoted: q });
        const out = sock.sent.find((s) => s.content[kind]);
        assert.ok(out, 'rien envoyé pour ' + kind);
        assert.equal(out.jid, MEMBER);
        if (kind === 'document') assert.equal(out.content.fileName, 'cv.pdf');
        if (kind === 'audio') assert.equal(out.content.ptt, true);
    }
});

test('save : sans réponse, ou sur du texte → explication', async () => {
    const sock = makeSock();
    await say(sock, 'save', { from: MEMBER });
    assert.match(texts(sock), /Réponds à un média/);
    sock.sent.length = 0;
    await say(sock, 'save', { from: MEMBER, quoted: { conversation: 'juste du texte' } });
    assert.match(texts(sock), /ne contient pas de média/);
});

// ───────────────────────── 5. Statuts
let tick = 0;
const statusMsg = (type, id, who = '224711111111@s.whatsapp.net', name = 'Awa') => ({
    key: { remoteJid: 'status@broadcast', participant: who, fromMe: false, id },
    pushName: name, messageTimestamp: Math.floor(Date.now() / 1000) + (++tick) * 5,
    message: type === 'text' ? { extendedTextMessage: { text: 'mon statut texte' } }
        : type === 'video' ? { videoMessage: { mimetype: 'video/mp4', caption: 'clip', __data: 'VID' } }
        : { imageMessage: { mimetype: 'image/jpeg', caption: 'photo', __data: 'IMG' } }
});
const OWNER_ME = { from: '224600000000@s.whatsapp.net', fromMe: true, group: null };

test('status : capture, liste, téléchargement par contact, filtre par type', async () => {
    const sock = makeSock();
    await run(sock, statusMsg('image', 'S1'));
    await run(sock, statusMsg('video', 'S2'));
    await run(sock, statusMsg('text', 'S3'));
    await run(sock, statusMsg('image', 'S4', '224722222222@s.whatsapp.net', 'Moussa'));
    assert.equal(sock.sent.length, 0, 'un statut ne doit rien déclencher');

    await say(sock, 'status liste', OWNER_ME);
    assert.match(texts(sock), /Awa/); assert.match(texts(sock), /Moussa/);
    sock.sent.length = 0;

    await say(sock, 'status 1', OWNER_ME);   // le plus récent = Moussa
    assert.ok(sock.sent.some((s) => s.content.image && s.jid === '224600000000@s.whatsapp.net'));
    sock.sent.length = 0;

    await say(sock, 'status 2 video', OWNER_ME);  // Awa, vidéos seulement
    const media = sock.sent.filter((s) => s.content.video || s.content.image || (s.content.text || '').includes('Statut'));
    assert.equal(sock.sent.filter((s) => s.content.video).length, 1);
    assert.equal(sock.sent.filter((s) => s.content.image).length, 0);
    sock.sent.length = 0;

    await say(sock, 'status tout', OWNER_ME);
    assert.equal(sock.sent.filter((s) => s.content.image).length, 2);
    assert.equal(sock.sent.filter((s) => s.content.video).length, 1);
    assert.ok(sock.sent.some((s) => (s.content.text || '').includes('mon statut texte')));
    sock.sent.length = 0;

    await say(sock, 'status 224711111111', OWNER_ME);   // par numéro
    assert.equal(sock.sent.filter((s) => s.content.video || s.content.image).length, 2);
});

test('status : en réponse à un statut → télécharge ce statut', async () => {
    const sock = makeSock();
    await run(sock, statusMsg('image', 'R1', '224733333333@s.whatsapp.net', 'Fatou'));
    await say(sock, 'status', { ...OWNER_ME, quoted: statusMsg('image', 'R1').message, ctxExtra: { stanzaId: 'R1', remoteJid: 'status@broadcast', participant: '224733333333@s.whatsapp.net' } });
    const out = sock.sent.find((s) => s.content.image);
    assert.ok(out, 'statut non renvoyé');
    assert.match(out.content.caption, /Fatou/);
    // statut jamais mémorisé : on utilise le contenu cité
    const sock2 = makeSock();
    await say(sock2, 'status', { ...OWNER_ME, quoted: { videoMessage: { mimetype: 'video/mp4', __data: 'V' } }, ctxExtra: { stanzaId: 'INCONNU', remoteJid: 'status@broadcast', participant: '224744444444@s.whatsapp.net' } });
    assert.ok(sock2.sent.some((s) => s.content.video));
});

test('status auto on : un nouveau statut est renvoyé automatiquement ; off : plus rien', async () => {
    const sock = makeSock();
    await say(sock, 'status auto on', OWNER_ME);
    assert.match(texts(sock), /activée/);
    sock.sent.length = 0;
    await run(sock, statusMsg('image', 'A1', '224755555555@s.whatsapp.net', 'Ibrahim'));
    assert.equal(sock.sent.filter((s) => s.content.image).length, 1);
    assert.equal(sock.sent[0].jid, '224600000000@s.whatsapp.net');
    await say(sock, 'status auto off', OWNER_ME);
    sock.sent.length = 0;
    await run(sock, statusMsg('image', 'A2', '224755555555@s.whatsapp.net', 'Ibrahim'));
    assert.equal(sock.sent.length, 0);
});

test('status : réservé au propriétaire, vider efface, statuts doublons ignorés', async () => {
    const sock = makeSock();
    await say(sock, 'status liste', { from: MEMBER });
    assert.match(texts(sock), /réservée au propriétaire/);
    await run(sock, statusMsg('image', 'D1', '224766666666@s.whatsapp.net'));
    await run(sock, statusMsg('image', 'D1', '224766666666@s.whatsapp.net'));
    const store = load('lib/statusStore.js');
    assert.equal(store.list(sock).filter((i) => i.id === 'D1').length, 1);
    sock.sent.length = 0;
    await say(sock, 'status vider', OWNER_ME);
    assert.match(texts(sock), /effacé/);
    assert.equal(store.list(sock).length, 0);
});

test('status : la mémoire survit à un redémarrage (JSON + clés binaires)', async () => {
    const store = load('lib/statusStore.js');
    const sock = makeSock();
    const m = statusMsg('image', 'P1', '224777777777@s.whatsapp.net', 'Persist');
    m.message.imageMessage.mediaKey = new Uint8Array([1, 2, 3, 250]);
    await run(sock, m);
    store.flush();
    store._reset();                             // simule un redémarrage
    const it = store.findById(sock, 'P1');
    assert.ok(it, 'statut perdu');
    assert.deepEqual([...it.content.imageMessage.mediaKey], [1, 2, 3, 250]);
});

test('status : parseArgs', () => {
    const { parseArgs } = load('commands/status.js');
    assert.equal(parseArgs([]).action, 'auto-detect');
    assert.deepEqual([parseArgs(['liste']).action, parseArgs(['tout']).action, parseArgs(['vider']).action], ['list', 'all', 'clear']);
    assert.deepEqual([parseArgs(['3']).action, parseArgs(['3']).index], ['contact', 3]);
    assert.equal(parseArgs(['224621963059']).number, '224621963059');
    assert.deepEqual([parseArgs(['2', 'video']).index, parseArgs(['2', 'video']).type], [2, 'video']);
    assert.equal(parseArgs(['video']).type, 'video');
    assert.deepEqual([parseArgs(['auto', 'on']).action, parseArgs(['auto', 'on']).onoff], ['auto', 'on']);
});

// ───────────────────────── 6. Antidelete
const revoke = (chat, id, participant) => ({ key: { remoteJid: chat, id, participant, fromMe: false }, update: { message: null, messageStubType: 1 } });

test('antidelete : réservé au propriétaire ; on/off ; texte supprimé → rapport en privé', async () => {
    const sock = makeSock();
    await say(sock, 'antidelete on', { from: MEMBER });
    assert.match(texts(sock), /réservée au propriétaire/);
    sock.sent.length = 0;
    await say(sock, 'antidelete on', OWNER_ME);
    assert.match(texts(sock), /activé/);
    sock.sent.length = 0;

    await run(sock, makeMsg({ text: 'message à supprimer', from: MEMBER, id: 'DEL1' }));
    await main.handleMessageUpdate(sock, [revoke(GROUP, 'DEL1', MEMBER)]);
    assert.equal(sock.sent.length, 1);
    assert.equal(sock.sent[0].jid, '224600000000@s.whatsapp.net');
    assert.match(sock.sent[0].content.text, /MESSAGE SUPPRIMÉ/);
    assert.match(sock.sent[0].content.text, /message à supprimer/);
    assert.match(sock.sent[0].content.text, /Groupe Test/);
    assert.match(sock.sent[0].content.text, /\+224700000002/);
});

test('antidelete : image, vidéo, audio, sticker, document, vue unique récupérés', async () => {
    const sock = makeSock();
    await say(sock, 'antidelete on', OWNER_ME);
    sock.sent.length = 0;
    const kinds = [
        ['image', { imageMessage: { mimetype: 'image/jpeg', caption: 'légende', __data: 'I' } }],
        ['video', { videoMessage: { mimetype: 'video/mp4', __data: 'V' } }],
        ['audio', { audioMessage: { mimetype: 'audio/ogg', ptt: true, __data: 'A' } }],
        ['sticker', { stickerMessage: { __data: 'S' } }],
        ['document', { documentMessage: { mimetype: 'application/pdf', fileName: 'x.pdf', __data: 'D' } }],
        ['image', viewOnceImage]
    ];
    for (const [i, [kind, content]] of kinds.entries()) {
        const id = 'MED' + i;
        await run(sock, makeMsg({ text: '', from: MEMBER, id, media: content, group: null }));  // en privé
        await main.handleMessageUpdate(sock, [revoke(MEMBER, id)]);
        assert.ok(sock.sent.some((s) => s.content[kind]), 'média non renvoyé : ' + kind + i);
    }
    assert.ok(sock.sent.every((s) => s.jid === '224600000000@s.whatsapp.net'));
    assert.ok(sock.sent.some((s) => (s.content.caption || '').includes('Vue unique') || (s.content.caption || '').includes('vue unique')));
});

test('antidelete : désactivé = rien ; message inconnu ou envoyé par moi = rien', async () => {
    const sock = makeSock();
    await say(sock, 'antidelete off', OWNER_ME);   // état propre (les tests précédents l'ont activé)
    sock.sent.length = 0;
    await run(sock, makeMsg({ text: 'avant activation', from: MEMBER, id: 'OFF1' }));
    await main.handleMessageUpdate(sock, [revoke(GROUP, 'OFF1', MEMBER)]);
    assert.equal(sock.sent.length, 0);
    await say(sock, 'antidelete on', OWNER_ME);
    sock.sent.length = 0;
    await main.handleMessageUpdate(sock, [revoke(GROUP, 'JAMAIS-VU', MEMBER)]);
    await run(sock, makeMsg({ text: 'à moi', from: '224600000000@s.whatsapp.net', fromMe: true, id: 'MINE' }));
    await main.handleMessageUpdate(sock, [revoke(GROUP, 'MINE', '224600000000@s.whatsapp.net')]);
    assert.equal(sock.sent.length, 0);
    // une mise à jour qui n'est pas une suppression est ignorée
    await run(sock, makeMsg({ text: 'ok', from: MEMBER, id: 'LU' }));
    await main.handleMessageUpdate(sock, [{ key: { remoteJid: GROUP, id: 'LU' }, update: { status: 3 } }]);
    assert.equal(sock.sent.length, 0);
});

test('antidelete : média expiré → rapport texte avec avertissement', async () => {
    const sock = makeSock();
    await say(sock, 'antidelete on', OWNER_ME);
    sock.sent.length = 0;
    await run(sock, makeMsg({ text: '', from: MEMBER, id: 'EXP', group: null, media: { imageMessage: { __fail: true } } }));
    await main.handleMessageUpdate(sock, [revoke(MEMBER, 'EXP')]);
    assert.match(sock.sent[0].content.text, /n'a pas pu être récupéré/);
});

// ───────────────────────── 7. profile
test('profile : mon profil, un membre mentionné, compteur de messages, rôle', async () => {
    const sock = makeSock();
    const PG = '120363444444444444@g.us';
    const MEMBER = '224700000002@s.whatsapp.net';
    for (let i = 0; i < 3; i++) await run(sock, makeMsg({ text: 'bla', from: MEMBER, group: PG }));
    await say(sock, 'profile', { from: MEMBER, group: PG });
    let out = sock.sent.find((s) => s.content.image);
    assert.match(out.content.caption, /Messages :\* 4/);   // 3 + la commande
    assert.match(out.content.caption, /Membre/);
    assert.match(out.content.caption, /\+224700000002/);
    assert.match(out.content.caption, /Hello bio/);
    sock.sent.length = 0;
    await say(sock, 'profile @x', { from: MEMBER, group: PG, ctxExtra: { mentionedJid: [ADMIN] } });
    out = sock.sent.find((s) => s.content.image);
    assert.match(out.content.caption, /Admin/);
    sock.sent.length = 0;
    await say(sock, 'profile 224700000001', { from: MEMBER, group: PG });
    assert.match(sock.sent[0].content.caption, /Admin/);
    sock.sent.length = 0;
    await say(sock, 'profile 224999999999', { from: MEMBER, group: PG });
    assert.match(texts(sock), /ne fait pas partie de ce groupe/);
});

test('profile : sans photo ni statut, en privé', async () => {
    const sock = makeSock({ noPic: true, bio: '' });
    await say(sock, 'profile', { from: MEMBER, group: null });
    assert.match(sock.sent[0].content.text, /Aucune photo/);
    assert.match(sock.sent[0].content.text, /Aucun statut/);
    assert.ok(!/Rôle/.test(sock.sent[0].content.text));
});

// ───────────────────────── 8. image
test('image : extraction Pinterest, meilleure taille, dédoublonnage', () => {
    const { extractPinUrls } = load('commands/image.js');
    const body = JSON.stringify({ results: [
        { images: { '236x': { url: 'https://i.pinimg.com/236x/ab/cd/ef/abcdef123.jpg' }, orig: { url: 'https://i.pinimg.com/originals/ab/cd/ef/abcdef123.jpg' } } },
        { images: { '736x': { url: 'https://i.pinimg.com/736x/11/22/33/112233zz.jpg' } } },
        { avatar: 'https://i.pinimg.com/75x75_RS/aa/bb/avatar.jpg' }
    ] }).replace(/\//g, '\\/');
    const urls = extractPinUrls(body);
    assert.deepEqual(urls, ['https://i.pinimg.com/originals/ab/cd/ef/abcdef123.jpg', 'https://i.pinimg.com/736x/11/22/33/112233zz.jpg']);
});

test('image : envoie jusqu\'à 10 images, bascule sur la source suivante, filtre les recherches interdites', async () => {
    const image = load('commands/image.js');
    const many = JSON.stringify(Array.from({ length: 15 }, (_, i) => `https://i.pinimg.com/736x/aa/bb/img${i}.jpg`));
    const calls = [];
    const deps = { get: async (url) => { calls.push(url); if (url.includes('pinterest.com/resource')) throw new Error('403'); return many; } };
    const sock = makeSock();
    await image(sock, GROUP, makeMsg({ text: 'image chat 10' }), ['chat', '10'], deps);
    assert.equal(sock.sent.filter((s) => s.content.image).length, 10);
    assert.ok(calls.length >= 2, 'pas de repli sur la 2e source');
    const sock2 = makeSock();
    await image(sock2, GROUP, makeMsg({ text: 'image chat 99' }), ['chat', '99'], deps);
    assert.equal(sock2.sent.filter((s) => s.content.image).length, 10, 'plafond de 10');
    const sock3 = makeSock();
    await image(sock3, GROUP, makeMsg({ text: '' }), ['paysage'], deps);
    assert.equal(sock3.sent.filter((s) => s.content.image).length, 5, '5 par défaut');
    const sock4 = makeSock();
    await image(sock4, GROUP, makeMsg({ text: '' }), ['porn'], deps);
    assert.match(texts(sock4), /pas autorisée/);
    const sock5 = makeSock();
    await image(sock5, GROUP, makeMsg({ text: '' }), [], deps);
    assert.match(texts(sock5), /Exemple/);
    const sock6 = makeSock();
    await image(sock6, GROUP, makeMsg({ text: '' }), ['rien'], { get: async () => { throw new Error('réseau'); } });
    assert.match(texts(sock6), /Aucune image trouvée/);
});

// ───────────────────────── 9. Divers
test('mode privé : seul le propriétaire est servi, y compris pour les nouvelles commandes', async () => {
    const sock = makeSock();
    await say(sock, 'mode private', OWNER_ME);
    sock.sent.length = 0;
    await say(sock, 'allmenu', { from: MEMBER });
    assert.equal(sock.sent.length, 0);
    await say(sock, 'allmenu', OWNER_ME);
    assert.equal(sock.sent.length, 1);
    await say(sock, 'mode public', OWNER_ME);
});

test('messages éphémères : les commandes sont toujours comprises', async () => {
    const sock = makeSock();
    const m = makeMsg({ text: '', from: MEMBER, media: { ephemeralMessage: { message: { extendedTextMessage: { text: 'allmenu' } } } } });
    await run(sock, m);
    assert.match(texts(sock), /TOUTES LES COMMANDES/);
});
