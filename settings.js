require('dotenv').config();

const clean = (n) => String(n || '').replace(/[^0-9]/g, '');
const DEFAULT_OWNERS = ['224621963059', '224663109041'];
const envOwners = (process.env.OWNER_NUMBERS || '').split(/[,;\s]+/).map(clean).filter(Boolean);
const ownerNumbers = envOwners.length ? [...new Set(envOwners)] : DEFAULT_OWNERS;
const ownerNames = (process.env.OWNER_NAMES || 'IB-SACKO,SALGA 🥷').split(',').map((s) => s.trim()).filter(Boolean);

const settings = {
  packname: process.env.PACK_NAME || 'SALGA-XMD',
  author: process.env.PACK_AUTHOR || 'IB-SACKO',
  botName: process.env.BOT_NAME || 'SALGA-XMD',

  // 👑 Propriétaires officiels du bot (tous ont les droits propriétaire).
  // Pour en changer : variable OWNER_NUMBERS="224...,224..." (séparés par des virgules).
  // (l'ancienne variable OWNER_NUMBER n'est plus utilisée)
  ownerNumbers: ownerNumbers,
  ownerNames: ownerNames,
  botOwner: ownerNames[1] || 'SALGA 🥷',
  ownerNumber: ownerNumbers[0],

  // 🛠️ Créateur / développeur du bot (accès total via sudo)
  creatorName: process.env.CREATOR_NAME || 'IB-SACKO',
  creatorNumber: process.env.CREATOR_NUMBER || '224621963059',

  system: process.env.SYSTEM_NAME || 'CENTRAL-HEX',

  prefix: '', // Bot sans préfixe : "menu" suffit
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.COMMAND_MODE || 'public',
  maxStoreMessages: 30,
  storeWriteInterval: 10000,
  description: 'Bot WhatsApp multifonctions - SALGA-XMD',
  version: process.env.BOT_VERSION || '1.0.0',
  ytch: process.env.YT_CHANNEL || '',
  waChannel: process.env.WA_CHANNEL || '',
};

module.exports = settings;

