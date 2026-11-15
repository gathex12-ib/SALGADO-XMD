// lib/ytdlp.js — télécharge l'audio d'une vidéo YouTube avec yt-dlp (SALGA-XMD)
// Le programme yt-dlp est cherché dans le système, sinon téléchargé automatiquement (data/bin/yt-dlp).
// Si YouTube bloque l'adresse du serveur ("Sign in to confirm you're not a bot"), fournir des cookies :
//   variable YT_COOKIES_B64 = contenu de cookies.txt (export YouTube) encodé en base64.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const axios = require('axios');

const BIN_DIR = path.join(__dirname, '../data/bin');
const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
let binPromise = null;

const works = (cmd) => { try { return spawnSync(cmd, ['--version'], { timeout: 20000 }).status === 0; } catch { return false; } };

async function ensureBinary() {
    if (process.env.YTDLP_PATH && works(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
    if (works('yt-dlp')) return 'yt-dlp';
    const local = path.join(BIN_DIR, 'yt-dlp');
    if (fs.existsSync(local) && works(local)) return local;
    if (process.platform !== 'linux') throw new Error('yt-dlp introuvable (installe-le ou définis YTDLP_PATH)');
    const asset = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const res = await axios.get(RELEASE + asset, { responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5 });
    fs.writeFileSync(local, Buffer.from(res.data), { mode: 0o755 });
    if (!works(local)) throw new Error('yt-dlp téléchargé mais inutilisable');
    return local;
}
const getBinary = () => {
    if (!binPromise) binPromise = ensureBinary().catch((e) => { binPromise = null; throw e; });
    return binPromise;
};

function run(bin, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const p = spawn(bin, args);
        let err = '';
        p.stderr.on('data', (d) => { err += d; });
        const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('yt-dlp : délai dépassé')); }, timeoutMs);
        p.on('error', (e) => { clearTimeout(t); reject(e); });
        p.on('close', (code) => {
            clearTimeout(t);
            if (code === 0) return resolve();
            reject(new Error('yt-dlp : ' + (err.trim().split('\n').filter(Boolean).pop() || `code ${code}`)));
        });
    });
}

/** Retourne { buffer, ext } ou lève une erreur. */
async function downloadAudio(url, { timeoutMs = 120000, maxMb = 40 } = {}) {
    const bin = await getBinary();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-'));
    const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } };
    try {
        const args = ['--no-playlist', '--no-warnings', '--no-progress', '--max-filesize', `${maxMb}M`, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-o', path.join(dir, 'audio.%(ext)s')];
        if (process.env.YT_COOKIES_B64) {
            const cookies = path.join(dir, 'cookies.txt');
            fs.writeFileSync(cookies, Buffer.from(process.env.YT_COOKIES_B64, 'base64'));
            args.push('--cookies', cookies);
        }
        let lastErr;
        // 1) avec le moteur JavaScript de Node (requis par les versions récentes de yt-dlp)  2) sans cette option
        for (const extra of [['--js-runtimes', 'node'], []]) {
            try {
                await run(bin, [...args, ...extra, url], timeoutMs);
                const file = fs.readdirSync(dir).find((n) => n.startsWith('audio.') && !n.endsWith('.part'));
                if (file) return { buffer: fs.readFileSync(path.join(dir, file)), ext: path.extname(file).slice(1) };
                lastErr = new Error('yt-dlp : aucun fichier produit');
            } catch (e) { lastErr = e; }
        }
        throw lastErr;
    } finally {
        cleanup();
    }
}

module.exports = { downloadAudio, getBinary };
