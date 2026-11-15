# ── SALGA-XMD — Image Docker unique pour Render / Railway / Koyeb ──
FROM node:20-bookworm-slim

# Dépendances système : ffmpeg (conversion média), libs pour sharp/canvas, git
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    build-essential \
    libvips-dev \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp (téléchargement des musiques) : si le téléchargement échoue ici, le bot le télécharge au premier usage
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod 755 /usr/local/bin/yt-dlp || echo "yt-dlp : installation différée"

WORKDIR /app

# Installe les dépendances Node d'abord (meilleur cache Docker)
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

# Copie le reste du projet
COPY . .

# Dossiers de session/temp créés au runtime, montés en volume persistant
RUN mkdir -p sessions session temp

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "web.js"]
