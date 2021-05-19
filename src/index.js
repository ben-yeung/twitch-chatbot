require = require("esm")(module /*, options*/ )
module.exports = require("./app.js")
const tmi = require('tmi.js');
const botconfig = require('../botconfig.json');

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
        username: botconfig.BOT_NAME, //bot name
        password: botconfig.OAUTH_TOKEN //oauth:bot-token (see https://dev.twitch.tv/docs/authentication/getting-tokens-oauth)
    },
    channels: [botconfig.CHANNEL_NAME] //channels to join
});
client.connect().catch(console.error);
client.on('message', (channel, userstate, message, self) => {
    if (self) return;
    const greetings = ['hi!', 'hey how are you?', 'yo what\'s up', 'heya!', 'hey'];
    const rand_greeting = greetings[Math.floor(Math.random() * greetings.length)];

    const comm = message.toLowerCase();
    if (comm === '!hello') {
        client.say(channel, `@${userstate.username}, ${rand_greeting}`);
    } else if (comm === '!help') {
        const arr = ['!hello', '!camera', '!sens', '!controls', '!creationmeta', '!coinflip'];
        const allComms = arr.join(", ");
        client.say(channel, `Here is a list of active commands: ${allComms}`);
    } else if (comm === '!flip' || comm === '!coinflip' || comm === '!flipcoin') {
        const rand = Math.floor(Math.random() * 2);
        if (rand == 0) {
            client.say(channel, `@${userstate.username} flips a coin and it's Heads!`)
        } else {
            client.say(channel, `@${userstate.username} flips a coin and it's Tails!`)
        }
    }

    moderateTwitchChat(userstate, message, channel);
});

function moderateTwitchChat(username, message, channel) {
    // check message for any blacklisted words 
    if (username.username === botconfig.CHANNEL_NAME) return; //ignore broadcaster messages
    message = message.toLowerCase();
    let wordFound = false;
    wordFound = botconfig.BLOCKED_WORDS.some(blocked => message.includes(blocked.toLowerCase()));

    if (wordFound) {
        //notify user of deletion
        client.say(channel, `@${username.username}, sorry! Your message was deleted as it contained a blacklisted word.`);

        //delete message if found in blacklist
        client.deletemessage(channel, username.id);
    }

}