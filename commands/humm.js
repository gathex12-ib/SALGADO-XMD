// humm.js — SALGA-XMD
// Réponds à un média "vue unique" avec : humm
// Le média est envoyé dans TON privé uniquement (jamais dans la conversation).
const { retrieveViewOnce } = require('../lib/viewonce');

async function hummCommand(sock, chatId, senderId, replyMessage, message) {
    await retrieveViewOnce(sock, chatId, senderId, message, 'humm');
}

module.exports = hummCommand;
