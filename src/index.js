require = require("esm")(module /*, options*/ )
module.exports = require("./app.js")
const tmi = require('tmi.js');

const client = new tmi.Client({
    options: {
        debug: true,
        messagesLogLevel: "info"
    },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: 'bot-name',
        password: 'oauth:my-bot-token'
    },
    channels: ['hyperstanced']
});
client.connect().catch(console.error);
client.on('message', (channel, userstate, message, self) => {
    if (self) return;
    if (message.toLowerCase() === '!hello') {
        client.say(channel, `@${userstate.username}, heya!`);
    }
});