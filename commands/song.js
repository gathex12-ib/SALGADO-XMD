// commands/song.js — SALGA-XMD
// song <titre ou lien YouTube> : télécharge la musique et l'envoie en audio MP3.
//
// Plusieurs sources sont essayées l'une après l'autre ; la première qui marche gagne :
//   1. yt-dlp (programme local, le plus fiable)           2. les API de téléchargement (liste modifiable)
//   3. Piped (instances publiques)
// Variables facultatives : SONG_APIS (liste JSON d'API, ex. [{"name":"x","url":"https://api.exemple/ytmp3?url={url}"}]),
// PIPED_INSTANCES (adresses séparées par des virgules), YT_COOKIES_B64 (cookies YouTube), YTDLP_PATH.
const axios = require('axios');
const yts = require('yt-search');
const { toAudio } = require('../lib/converter');
const ytdlp = require('../lib/ytdlp');
const { getText } = require('../lib/helpers');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_SECONDS = 20 * 60;
const MAX_BYTES = 40 * 1024 * 1024;

const DEFAULT_APIS = [
    { name: 'EliteProTech', url: 'https://eliteprotech-apis.zone.id/ytdown?url={url}&format=mp3' },
    { name: 'Yupra', url: 'https://api.yupra.my.id/api/downloader/ytmp3?url={url}' },
    { name: 'Okatsu', url: 'https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url={url}' }
];
function configuredApis() {
    try {
        const extra = JSON.parse(process.env.SONG_APIS || '[]');
        if (Array.isArray(extra)) return [...extra.filter((a) => a && a.url), ...DEFAULT_APIS];
    } catch { /* SONG_APIS invalide : ignoré */ }
    return DEFAULT_APIS;
}
const PIPED = () => (process.env.PIPED_INSTANCES || 'https://pipedapi.kavin.rocks,https://pipedapi.adminforge.de,https://api.piped.private.coffee')
    .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

const http = {
    getJson: (url) => axios.get(url, { timeout: 20000, headers: { 'User-Agent': UA, Accept: 'application/json' } }).then((r) => r.data),
    getBuffer: (url) => axios.get(url, {
        responseType: 'arraybuffer', timeout: 90000, maxContentLength: MAX_BYTES, maxBodyLength: MAX_BYTES,
        decompress: true, headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Encoding': 'identity' }
    }).then((r) => Buffer.from(r.data))
};

// ── Outils ──────────────────────────────────────────────────────────────────
function videoIdOf(url) {
    const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
}

/** Trouve une adresse de téléchargement dans la réponse d'une API, quelle que soit sa forme. */
function pickDownloadUrl(data) {
    const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && !/ytimg\.com|\.(jpe?g|png|webp)(\?|$)/i.test(v) && !/youtube\.com\/watch|youtu\.be\//i.test(v);
    const preferred = ['downloadURL', 'download_url', 'downloadUrl', 'dl', 'download', 'mp3', 'audio', 'link', 'url'];
    const seen = new Set();
    const walk = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 5 || seen.has(node)) return null;
        seen.add(node);
        for (const k of preferred) if (isUrl(node[k])) return node[k];
        for (const v of Object.values(node)) {
            if (isUrl(v)) return v;
            const r = walk(v, depth + 1);
            if (r) return r;
        }
        return null;
    };
    return walk(data, 0);
}

/** Reconnaît un vrai fichier audio (rejette les pages HTML / erreurs JSON renvoyées à la place). */
function sniffAudio(buf) {
    if (!buf || buf.length < 2048) return null;
    const head = buf.subarray(0, 12);
    if (head.toString('latin1', 0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return 'mp3';
    if (head.toString('latin1', 4, 8) === 'ftyp') return 'm4a';
    if (head.toString('latin1', 0, 4) === 'OggS') return 'ogg';
    if (head.toString('latin1', 0, 4) === 'RIFF') return 'wav';
    if (head.toString('latin1', 0, 4) === 'fLaC') return 'flac';
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
    return null;
}

// ── Recherche ───────────────────────────────────────────────────────────────
async function findVideo(query, deps = {}) {
    const d = { yts, http, piped: PIPED(), ...deps };
    if (/youtube\.com|youtu\.be/i.test(query)) {
        const url = query.match(/https?:\/\/\S+/)?.[0] || query;
        const id = videoIdOf(url);
        return { url: id ? `https://www.youtube.com/watch?v=${id}` : url, id, title: null, thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null, seconds: 0, timestamp: '' };
    }
    try {
        const res = await d.yts(query);
        if (res?.videos?.length) return res.videos[0];
    } catch (e) { console.error('❌ [song] recherche yt-search:', e.message); }
    for (const inst of d.piped) {   // repli : recherche via Piped
        try {
            const data = await d.http.getJson(`${inst}/search?q=${encodeURIComponent(query)}&filter=videos`);
            const it = (data.items || []).find((x) => x.url && /watch\?v=/.test(x.url));
            if (it) {
                const id = it.url.split('v=')[1];
                return { url: `https://www.youtube.com/watch?v=${id}`, id, title: it.title, thumbnail: it.thumbnail, seconds: it.duration || 0, timestamp: it.duration ? `${Math.floor(it.duration / 60)}:${String(it.duration % 60).padStart(2, '0')}` : '' };
            }
        } catch (e) { console.error(`❌ [song] Piped ${inst}:`, e.message); }
    }
    return null;
}

// ── Téléchargement : plusieurs sources, la première qui marche gagne ─────────
async function fetchAudio(video, deps = {}) {
    const d = { ytdlp, http, apis: configuredApis(), piped: PIPED(), ...deps };
    const failures = [];
    const accept = (buffer, title) => {
        const ext = sniffAudio(buffer);
        if (!ext) throw new Error('fichier reçu invalide (ce n\'est pas de l\'audio)');
        return { buffer, ext, title };
    };

    // 1) yt-dlp
    try {
        const r = await d.ytdlp.downloadAudio(video.url);
        return accept(r.buffer, video.title);
    } catch (e) { failures.push(`yt-dlp: ${e.message}`); }

    // 2) API de téléchargement
    for (const api of d.apis) {
        try {
            const data = await d.http.getJson(api.url.replace('{url}', encodeURIComponent(video.url)));
            const link = pickDownloadUrl(data);
            if (!link) throw new Error('aucun lien dans la réponse');
            const title = data?.title || data?.data?.title || data?.result?.title || video.title;
            return accept(await d.http.getBuffer(link), title);
        } catch (e) { failures.push(`${api.name || api.url}: ${e.message}`); }
    }

    // 3) Piped
    if (video.id) {
        for (const inst of d.piped) {
            try {
                const data = await d.http.getJson(`${inst}/streams/${video.id}`);
                const streams = (data.audioStreams || []).filter((s) => s.url).sort((a, b) => (/mp4/.test(b.mimeType) - /mp4/.test(a.mimeType)) || (b.bitrate - a.bitrate));
                if (!streams.length) throw new Error('aucun flux audio');
                return accept(await d.http.getBuffer(streams[0].url), data.title || video.title);
            } catch (e) { failures.push(`Piped ${inst}: ${e.message}`); }
        }
    }
    const err = new Error('Toutes les sources ont échoué');
    err.failures = failures;
    throw err;
}

async function songCommand(sock, chatId, message, deps = {}) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    try {
        const query = getText(message.message).split(/\s+/).slice(1).join(' ').trim();
        if (!query) return reply('🎵 *Musique*\n\nÉcris le titre ou colle un lien YouTube.\nExemple : *song Burna Boy Last Last*');

        const video = await findVideo(query, deps);
        if (!video) return reply(`❌ Aucun résultat pour *${query}*. Essaie avec d'autres mots, ou colle un lien YouTube.`);
        if (video.seconds && video.seconds > MAX_SECONDS) return reply(`❌ Cette vidéo est trop longue (${video.timestamp || Math.round(video.seconds / 60) + ' min'}). Maximum : ${MAX_SECONDS / 60} minutes.`);

        const label = video.title || 'ta musique';
        try {
            const caption = `🎵 *Téléchargement :* ${label}${video.timestamp ? `\n⏱ *Durée :* ${video.timestamp}` : ''}`;
            if (video.thumbnail) await sock.sendMessage(chatId, { image: { url: video.thumbnail }, caption }, { quoted: message });
            else await reply(caption);
        } catch { /* la miniature n'est pas indispensable */ }

        let audio;
        try {
            audio = await fetchAudio(video, deps);
        } catch (e) {
            console.error('❌ [song] toutes les sources ont échoué →', (e.failures || [e.message]).join(' | '));
            return reply(`❌ Impossible de télécharger *${label}* pour le moment.\n\nYouTube bloque parfois les serveurs d'hébergement. Réessaie dans un instant, avec un autre titre ou avec un lien YouTube.`);
        }

        let { buffer, ext } = audio;
        if (ext !== 'mp3') {
            try { buffer = await (deps.toAudio || toAudio)(buffer, ext); }
            catch (e) { console.error('❌ [song] conversion:', e.message || e); return reply('❌ Le fichier a été téléchargé mais la conversion en MP3 a échoué.'); }
        }
        const fileName = `${String(audio.title || label).replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().slice(0, 80) || 'musique'}.mp3`;
        if (buffer.length > 15 * 1024 * 1024) {
            await sock.sendMessage(chatId, { document: buffer, mimetype: 'audio/mpeg', fileName }, { quoted: message });   // trop gros pour un audio WhatsApp
        } else {
            await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/mpeg', fileName, ptt: false }, { quoted: message });
        }
    } catch (err) {
        console.error('Song command error:', err);
        await reply('❌ Une erreur est survenue pendant le téléchargement. Réessaie dans un instant.');
    }
}

module.exports = songCommand;
module.exports.fetchAudio = fetchAudio;
module.exports.findVideo = findVideo;
module.exports.pickDownloadUrl = pickDownloadUrl;
module.exports.sniffAudio = sniffAudio;
module.exports.videoIdOf = videoIdOf;
