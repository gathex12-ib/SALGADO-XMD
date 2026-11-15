// Prépare un environnement de test isolé : copie du projet dans un dossier temporaire
// (pour ne jamais toucher aux vrais fichiers data/), et remplace Baileys par un faux module.
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const SRC = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'salga-test-'));
for (const entry of ['lib', 'commands', 'data', 'settings.js', 'config.js', 'main.js', 'package.json']) {
    fs.cpSync(path.join(SRC, entry), path.join(TMP, entry), { recursive: true });
}
fs.writeFileSync(path.join(TMP, 'data', 'userGroupData.json'), JSON.stringify({ antibadword: {}, antilink: {}, welcome: {}, goodbye: {}, chatbot: {}, warnings: {}, sudo: [] }));
for (const f of ['antivv.json', 'antidelete.json', 'status_cache.json', 'status_settings.json']) { try { fs.rmSync(path.join(TMP, 'data', f)); } catch { /* absent */ } }
process.chdir(TMP);

// main.js lance un nettoyage périodique (setInterval) : on le « unref » pour que les tests puissent se terminer
const realSetInterval = global.setInterval;
global.setInterval = (...a) => { const t = realSetInterval(...a); if (t && t.unref) t.unref(); return t; };
delete process.env.OWNER_NUMBERS;

const stubProxy = () => new Proxy(function () {}, { get: (t, k) => (k === '__esModule' ? false : stubProxy()), apply: () => stubProxy() });

const baileysStub = {
    // Télécharge "content.__data" (test) ; "content.__fail" simule un média expiré
    downloadContentFromMessage: async (content) => {
        if (content.__fail) throw new Error('média expiré');
        return (async function* () { yield Buffer.from(content.__data || 'data'); })();
    },
    delay: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
    default: () => { throw new Error('non utilisé en test'); },
    jidNormalizedUser: (j) => j
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === '@whiskeysockets/baileys') return baileysStub;
    try {
        return origLoad.apply(this, arguments);
    } catch (e) {
        // modules lourds non installés (ytdl, sharp…) : faux module, inutile pour ces tests
        if (e.code === 'MODULE_NOT_FOUND' && !request.startsWith('.') && !path.isAbsolute(request)) return stubProxy();
        throw e;
    }
};

const load = (rel) => require(path.join(TMP, rel));

// Faux socket : enregistre tout ce que le bot envoie
function makeSock(opts = {}) {
    const sent = [];
    const meta = opts.meta || {
        subject: 'Groupe Test', desc: 'Une description',
        participants: [
            { id: '224700000001@s.whatsapp.net', admin: 'admin' },
            { id: '224700000002@s.whatsapp.net' },
            { id: '224600000000@s.whatsapp.net', admin: 'admin' }
        ]
    };
    return {
        sent,
        user: { id: '224600000000:12@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); return { key: { id: 'sent' + sent.length } }; },
        groupMetadata: async () => meta,
        profilePictureUrl: async () => { if (opts.noPic) throw new Error('pas de photo'); return 'https://pic.example/p.jpg'; },
        fetchStatus: async () => [{ id: 'x', status: { status: opts.bio ?? 'Hello bio', setAt: new Date() } }]
    };
}

// Fabrique un message reçu
function makeMsg({ text, from = '224700000001@s.whatsapp.net', group = '120363000000000000@g.us', fromMe = false, quoted, ctxExtra, id, pushName = 'Tester', media }) {
    const chat = group || from;
    const contextInfo = quoted ? { quotedMessage: quoted, stanzaId: 'q1', participant: '224700000002@s.whatsapp.net', ...(ctxExtra || {}) } : ctxExtra ? { ...ctxExtra } : undefined;
    const message = media || (contextInfo ? { extendedTextMessage: { text, contextInfo } } : { conversation: text });
    return { key: { remoteJid: chat, fromMe, id: id || 'M' + Math.random().toString(36).slice(2, 8), participant: group ? from : undefined }, pushName, messageTimestamp: Math.floor(Date.now() / 1000), message };
}

const texts = (sock) => sock.sent.map((s) => s.content.text || s.content.caption || '').join('\n---\n');

module.exports = { TMP, load, makeSock, makeMsg, texts };
