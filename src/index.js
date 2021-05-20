require = require("esm")(module /*, options*/ )
module.exports = require("./app.js")
const tmi = require('tmi.js');
const botconfig = require('../botconfig.json');
const request = require("request");
var base64 = require('base-64');
var express = require('express');
var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi({
    clientId: botconfig.SPOTIFY_CLIENT_ID,
    clientSecret: botconfig.SPOTIFY_CLIENT_SECRET,
    redirectUri: botconfig.SPOTIFY_REDIRECT_URI
});

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


// Example from https://github.com/tombaranowicz/SpotifyPlaylistExport/blob/master/index.js
const scopes = ['user-modify-playback-state'];
const app = express();
var access_token;
var refresh_token;

app.get('/login', (req, res) => {
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
})

app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    const state = req.query.state;

    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    spotifyApi
        .authorizationCodeGrant(code)
        .then(data => {
            access_token = data.body['access_token'];
            refresh_token = data.body['refresh_token'];
            const expires_in = data.body['expires_in'];

            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);

            console.log('access_token:', access_token);
            console.log('refresh_token:', refresh_token);

            console.log(
                `Sucessfully retreived access token. Expires in ${expires_in} s.`
            );
            setInterval(async () => {
                const data = await spotifyApi.refreshAccessToken();
                access_token = data.body['access_token'];

                console.log('The access token has been refreshed!');
                console.log('access_token:', access_token);
                spotifyApi.setAccessToken(access_token);
            }, expires_in / 2 * 1000);

        })
        .catch(error => {
            console.error('Error getting Tokens:', error);
            res.send(`Error getting Tokens: ${error}`);
        });
})

app.listen(8888, () =>
    console.log(
        'HTTP Server up. Now go to http://localhost:8888/login in your browser.'
    )
);

client.on('message', async (channel, userstate, message, self) => {
    if (self) return;

    let moderated = moderateTwitchChat(userstate, message, channel);
    if (moderated) return;

    const greetings = ['hi!', 'hey how are you?', 'yo what\'s up', 'heya!', 'hey'];
    const rand_greeting = greetings[Math.floor(Math.random() * greetings.length)];

    const comm = message.toLowerCase().split(' ');

    if (comm[0] === '!hello') {
        client.say(channel, `@${userstate.username}, ${rand_greeting}`);
    } else if (comm[0] === '!help') {
        const arr = ['!hello', '!camera', '!sens', '!controls', '!creationmeta', '!coinflip'];
        const allComms = arr.join(", ");
        client.say(channel, `Here is a list of active commands: ${allComms}`);
    } else if (comm[0] === '!flip' || comm === '!coinflip' || comm === '!flipcoin') {
        const rand = Math.floor(Math.random() * 2);
        if (rand == 0) {
            client.say(channel, `@${userstate.username} flips a coin and it's Heads!`)
        } else {
            client.say(channel, `@${userstate.username} flips a coin and it's Tails!`)
        }
    } else if (comm[0] === '!queue') {
        if (!comm[1]) return client.say(channel, `@${userstate.username} you must specify a Spotify song name with command !queue`)

        // THIS IS CLIENT CREDENTIALS (SUITABLE FOR BASIC LOOKUP / NO USER AUTH)
        // SEE https://developer.spotify.com/documentation/general/guides/authorization-guide/#authorization-code-flow
        // const getToken = (url, callback) => {
        //     const options = {
        //         url: url, //See https://developer.spotify.com/documentation/general/guides/authorization-guide/#client-credentials-flow
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/x-www-form-urlencoded',
        //             'Authorization': 'Basic ' + base64.encode(botconfig.SPOTIFY_CLIENT_ID + ':' + botconfig.SPOTIFY_CLIENT_SECRET)
        //         },
        //         body: {
        //             'grant_type': 'client_credentials',
        //             'scope': 'user-modify-playback-state'
        //         }
        //     };

        //     request.post(options, (err, res, body) => {
        //         if (err) {
        //             return console.log(err);
        //         }
        //         console.log(`Status: ${res.statusCode}`);
        //         console.log(body);

        //         callback(res);
        //     })
        // };
        // var AT = ''; //OAuth App Acces Token (For clip GET request)
        // getToken(botconfig.SPOTIFY_GET_TOKEN, (res) => {
        //     AT = JSON.parse(res.body).access_token;
        //     return AT;
        // })

        const data = await spotifyApi.refreshAccessToken();
        access_token = data.body['access_token'];

        console.log('The access token has been refreshed!');
        console.log('access_token:', access_token);
        spotifyApi.setAccessToken(access_token);

        const getSongURI = (url, callback) => {
            // see https://developer.spotify.com/console/get-search-item/

            const songOptions = {
                url: url,
                method: "GET",
                headers: {
                    'Authorization': 'Bearer ' + access_token
                }
            };
            request.get(songOptions, (err, res, body) => {
                if (err) {
                    return console.log(err);
                }
                console.log(`Status: ${res.statusCode}`);
                console.log(body);

                callback(res);
            });
        }
        setTimeout(() => {
            var songURI = '';
            var artistArr = [];
            var artist = '';
            var song = '';
            getSongURI(`https://api.spotify.com/v1/search?q=${comm.slice(1).join("%20")}&type=track&limit=1&offset=0`, (res) => {
                songURI = JSON.parse(res.body).tracks.items[0].uri;
                const artists = JSON.parse(res.body).tracks.items[0].artists;

                for (var i = 0; i < artists.length; i++) {
                    artistArr.push(artists[i].name);
                }
                artist = artistArr.join(", ");
                song = JSON.parse(res.body).tracks.items[0].name;
                console.log(artist)
                console.log(song)
                console.log(songURI)
                const addToQueue = (url, uri) => {
                    // see https://developer.spotify.com/documentation/web-api/reference/#endpoint-add-to-queue
                    const idOptions = {
                        url: `${url}?uri=${uri}&device_id=${botconfig.SPOTIFY_DEVICE_ID}`,
                        json: true,
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        }
                    };
                    request.post(idOptions, (err, res, body) => {
                        if (err) {
                            return console.log(err);
                        }
                        console.log(`Status: ${res.statusCode}`);
                        //console.log(body);

                    });
                };
                setTimeout(() => {
                    addToQueue(botconfig.SPOTIFY_QUEUE_LINK, songURI)
                    client.say(channel, `@${userstate.username}, I've added ${song} by ${artist} to the queue!`)
                }, 1000)
            })
        }, 1000)
    } else if (comm === '!skip') {
        if (!userstate.mod) return;

        const data = await spotifyApi.refreshAccessToken();
        access_token = data.body['access_token'];

        console.log('The access token has been refreshed!');
        console.log('access_token:', access_token);
        spotifyApi.setAccessToken(access_token);
    }

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
        return true;
    } else {
        return false;
    }

}