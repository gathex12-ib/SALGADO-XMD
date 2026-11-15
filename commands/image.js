// commands/image.js — SALGA-XMD
// "image <recherche> [nombre]" : cherche des images sur le web (Pinterest) et en envoie jusqu'à 10.
const axios = require('axios');
const { sleep } = require('../lib/helpers');

const MAX_IMAGES = 10;
const DEFAULT_IMAGES = 5;
const BLOCKED = /\b(porn\w*|xxx|nude\w*|nue?s?|naked|sex\w*|hentai|nsfw|erotic\w*|onlyfans|fetish\w*|gore)\b/i;
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

// Ordre de préférence des tailles Pinterest
const SIZE_RANK = ['originals', '736x', '564x', '474x', '236x'];

/** Cherche récursivement toutes les URLs d'images Pinterest dans n'importe quelle réponse (JSON ou HTML). */
function extractPinUrls(input) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const re = /https?:\\?\/\\?\/i\.pinimg\.com\\?\/(originals|736x|564x|474x|236x)\\?\/([A-Za-z0-9_\-\/\\]+?\.(?:jpg|jpeg|png|webp))/gi;
    const best = new Map(); // identifiant de l'image → { rank, url }
    let m;
    while ((m = re.exec(text))) {
        const size = m[1].toLowerCase();
        const file = m[2].replace(/\\/g, '');
        const id = file.split('/').pop().replace(/\.[a-z]+$/i, '');
        const rank = SIZE_RANK.indexOf(size);
        const url = `https://i.pinimg.com/${size}/${file}`;
        const cur = best.get(id);
        if (!cur || rank < cur.rank) best.set(id, { rank, url });
    }
    return [...best.values()].map((v) => v.url);
}

const http = {
    get: (url, headers = {}) => axios.get(url, { timeout: 15000, headers: { 'User-Agent': UA, Accept: 'application/json, text/html', ...headers }, responseType: 'text', transformResponse: (r) => r }).then((r) => r.data)
};

function sources(query) {
    const q = encodeURIComponent(query);
    const data = encodeURIComponent(JSON.stringify({ options: { isPrefetch: false, query, scope: 'pins', no_fetch_context_on_resource: false }, context: {} }));
    return [
        { name: 'pinterest', url: `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent('/search/pins/?q=' + query)}&data=${data}&_=${Date.now()}`, headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-AppState': 'active', Accept: 'application/json' } },
        { name: 'siputzx', url: `https://api.siputzx.my.id/api/s/pinterest?query=${q}` },
        { name: 'pinterest-html', url: `https://www.pinterest.com/search/pins/?q=${q}&rs=typed` }
    ];
}

/** Retourne jusqu'à `limit` URLs d'images. `deps.get` est injectable pour les tests. */
async function searchImages(query, limit = DEFAULT_IMAGES, deps = http) {
    const urls = [];
    const errors = [];
    for (const src of sources(query)) {
        try {
            const body = await deps.get(src.url, src.headers || {});
            for (const u of extractPinUrls(body)) if (!urls.includes(u)) urls.push(u);
            if (urls.length >= limit) break;
        } catch (e) {
            errors.push(`${src.name}: ${e.message}`);
        }
    }
    if (!urls.length && errors.length) console.error('❌ [image] sources en échec →', errors.join(' | '));
    return urls.slice(0, limit);
}

/** Sépare "chats mignons 7" en { query: "chats mignons", count: 7 }. */
function parseQuery(args) {
    const parts = [...args];
    let count = DEFAULT_IMAGES;
    const last = parts[parts.length - 1];
    if (parts.length > 1 && /^\d{1,2}$/.test(last)) {
        count = Math.max(1, Math.min(MAX_IMAGES, parseInt(last, 10)));
        parts.pop();
    }
    return { query: parts.join(' ').trim(), count };
}

async function imageCommand(sock, chatId, message, args, deps) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const { query, count } = parseQuery(args || []);
    if (!query) return reply('🖼️ *Recherche d\'images*\n\nExemple : *image chat mignon*\nPour choisir le nombre (max 10) : *image paysage montagne 8*');
    if (BLOCKED.test(query)) return reply('❌ Cette recherche n\'est pas autorisée.');

    let urls;
    try {
        urls = await searchImages(query, count, deps || http);
    } catch (e) {
        urls = [];
    }
    if (!urls.length) return reply(`❌ Aucune image trouvée pour *${query}*.\nEssaie avec d'autres mots-clés, ou réessaie dans un instant.`);

    await reply(`🔎 *${urls.length}* image(s) trouvée(s) pour *${query}*…`);
    let sent = 0;
    for (const [i, url] of urls.entries()) {
        try {
            await sock.sendMessage(chatId, { image: { url }, caption: `🖼️ ${query} (${i + 1}/${urls.length})\n> 🥷 _SALGA-XMD_` });
            sent++;
        } catch (e) {
            console.error('❌ [image] envoi:', e.message);
        }
        await sleep(600);
    }
    if (!sent) await reply('❌ Impossible d\'envoyer les images pour le moment. Réessaie plus tard.');
}

module.exports = imageCommand;
module.exports.searchImages = searchImages;
module.exports.extractPinUrls = extractPinUrls;
module.exports.parseQuery = parseQuery;
module.exports.BLOCKED = BLOCKED;
