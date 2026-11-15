# SALGADO-XMD
Un bot WhatsApp crée pas ibrahima sory sacko 
# 🥷 SALGA-XMD

Bot WhatsApp multi-device **sans préfixe** — tape simplement le nom d'une commande (ex. `menu`, `ping`, `owner`) et le bot répond directement.

Créé par **IB-SACKO** · Propriétaires **IB-SACKO** et **SALGA 🥷** · Système **CENTRAL-HEX**

📢 Rejoindre la communauté : https://whatsapp.com/channel/0029VbC8YkY7oQhiOiiSpy1z

---

## ⚡ Connexion (aucune installation pour l'utilisateur final)

1. Déploie le bot sur ton propre serveur/hébergeur Node.js (voir plus bas).
2. Ouvre la page d'accueil (`/`) servie par `web.js`.
3. Entre ton numéro WhatsApp (avec l'indicatif pays) et clique sur **Obtenir le code**, ou choisis l'onglet **QR Code**.
4. Sur ton téléphone : WhatsApp → ⋮ → Appareils liés → Lier un appareil → Lier avec un numéro de téléphone → entre le code (ou scanne le QR).
5. C'est prêt : tape `menu` dans n'importe quelle conversation.

## 📋 Les commandes

Tape `allmenu` pour la liste compacte, ou `help <commande>` pour le détail d'une commande.

| Commande | Description |
|---|---|
| `menu` | Menu illustré du bot |
| `allmenu` | Liste compacte de toutes les commandes, par catégorie |
| `help` / `help <commande>` | Guide général, ou explication détaillée d'une commande |
| `ping` · `info` | Vitesse et informations du bot |
| `owner` | Propriétaires du bot (+224621963059 · +224663109041) |
| `profile [@membre / numéro]` | Fiche : nom, numéro, statut, photo, rôle et nombre de messages (en groupe) |
| `mode public/private` | Mode d'accès au bot (propriétaire) |
| `pair <numéro>` | Connecte un autre numéro |
| `tagall` · `kick` · `kickall` · `open` · `close` · `delete` | Gestion du groupe (admins) |
| `welcome on/off/set/reset` | Message de bienvenue — **désactivé par défaut**, ne réagit qu'après `welcome on` |
| `goodbye on/off/set/reset` | Message d'au revoir — **désactivé par défaut**, ne réagit qu'après `goodbye on` |
| `antilink` · `link` · `antibot` | Protections de groupe (admins) |
| `antivv on/off` | Récupère automatiquement les médias vue unique |
| `antidelete on/off` | Rapport privé quand quelqu'un supprime un message (texte, médias, vue unique) — propriétaire |
| `sticker` / `s` · `toimg` | Image/vidéo ↔ sticker |
| `song <nom>` | Télécharge une musique |
| `image <recherche> [nombre]` | Images Pinterest, jusqu'à 10 |
| `save` | (en réponse à un média) sauvegarde dans ton privé |
| `waouh` · `humm` | (en réponse à une vue unique) récupération discrète en privé |
| `status …` | Téléchargeur de statuts WhatsApp (propriétaire) — voir `help status` |
| `gpt <question>` | Assistant IA |

### 📥 Statuts WhatsApp (`status`)

- `status` en réponse à un statut → le télécharge · `status liste` → contacts qui ont publié (24 h)
- `status 2` → statuts du contact n°2 · `status 224…` → par numéro · `status tout` → tous
- `status image|video|audio|texte` → filtre par type (ex. `status 2 video`)
- `status auto on/off` → chaque nouveau statut est renvoyé automatiquement dans ton privé
- `status vider` → efface la mémoire

Seuls les statuts publiés **pendant que le bot est connecté** sont mémorisés (24 h, conservés après redémarrage).

## 🛡️ Dashboard admin

Accessible sur `/admin` (mot de passe défini par `ADMIN_PASSWORD` dans `.env`) :
- État de connexion, mémoire, uptime, version
- Basculer mode public/privé et mode maintenance
- Liste des sessions WhatsApp connectées
- Redémarrage du bot
- Mise à jour du code depuis un lien ZIP (ex. "Download ZIP" GitHub)

## ⚙️ Installation

```bash
git clone <ton-dépôt>
cd SALGA-XMD
npm install
cp .env.example .env   # puis renseigne ADMIN_PASSWORD et GROQ_API_KEY si besoin
node web.js
```

Le serveur démarre sur le port `3000` (configurable via `PORT`). Ouvre `http://localhost:3000` pour connecter un numéro.

### Déploiement (Docker / Railway / Koyeb)

Le projet inclut un `Dockerfile`, un `railway.toml` et un `koyeb.yaml` prêts à l'emploi si tu préfères déployer sur une plateforme plutôt qu'en local — mais ce n'est pas obligatoire : le bot fonctionne aussi bien sur un simple VPS ou en local avec `node web.js`.

## 🔧 Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `OWNER_NUMBERS` | Numéros propriétaires, séparés par des virgules (défaut : `224621963059,224663109041`) |
| `CREATOR_NUMBER` / `CREATOR_NAME` | Numéro et nom du créateur |
| `ADMIN_PASSWORD` | Mot de passe du dashboard `/admin` |
| `GROQ_API_KEY` | Clé API pour la commande `gpt` (gratuite sur console.groq.com) |
| `COMMAND_MODE` | `public` ou `private` par défaut |

## 👤 Créateur & Communauté

- 🛠️ Créateur : **IB-SACKO** — +224 621 963 059
- 👑 Propriétaires : **IB-SACKO** — +224 621 963 059 · **SALGA 🥷** — +224 663 109 041
- 💎 Système : **CENTRAL-HEX**
- 📢 Chaîne WhatsApp : https://whatsapp.com/channel/0029VbC8YkY7oQhiOiiSpy1z

---

<div align="center">Propulsé par 🥷 <b>CENTRAL-HEX</b></div>
 

## 🧪 Tests

```bash
npm test   # 35 tests automatiques (Baileys est simulé, aucun vrai compte WhatsApp n'est utilisé)
```
