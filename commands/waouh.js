// waouh.js — SALGA-XMD
// Réponds à un média "vue unique" avec : waouh
// Le média est envoyé dans TON privé uniquement (jamais dans la conversation).
const { retrieveViewOnce } = require('../lib/viewonce');

async function waouhCommand(sock, chatId, senderId, replyMessage, message) {
    await retrieveViewOnce(sock, chatId, senderId, message, 'waouh');
}

module.exports = waouhCommand;
