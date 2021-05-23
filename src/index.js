require = require("esm")(module /*, options*/ );
module.exports = require("./app.js");
const tmi = require('tmi.js');
const botconfig = require('../botconfig.json');
const request = require("request");
const cron = require('cron');
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
        password: botconfig.OAUTH_TOKEN_BOT //oauth:bot-token (see https://dev.twitch.tv/docs/authentication/getting-tokens-oauth)
    },
    channels: [botconfig.CHANNEL_NAME] //channels to join
});
client.connect().catch(console.error);


// Example from https://github.com/tombaranowicz/SpotifyPlaylistExport/blob/master/index.js
const scopes = ['user-modify-playback-state', 'user-read-currently-playing', 'user-read-recently-played'];
const app = express();
var access_token;
var refresh_token;
var queue = [];
var lastContext = botconfig.SPOTIFY_DEFAULT_CONTEXT; // This is used for fallback when context is null, else it would be last context uri

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
            // setInterval(async () => {
            //     const data = await spotifyApi.refreshAccessToken();
            //     access_token = data.body['access_token'];

            //     console.log('The access token has been refreshed!');
            //     console.log('access_token:', access_token);
            //     spotifyApi.setAccessToken(access_token);
            // }, expires_in / 2 * 1000);

        })
        .catch(error => {
            console.error('Error getting Tokens:', error);
            res.send(`Error getting Tokens: ${error}`);
        });
})

// With http://localhost:8888/login approved in Spotify dashboard, visiting this will generate access and refresh tokens
app.listen(8888, () =>
    console.log(
        'HTTP Server up. Now go to http://localhost:8888/login in your browser.' //add this to spotify dashboard redirect URLs to validate
    )
);

// Setting refresh token to refresh access token
// Since refresh tokens have extended life we don't need to load http://localhost:8888/login everytime given a valid refresh token
// This will allow spotifyApi.refreshAccessToken() to work when bot goes online (no need to generate with redirect url)
spotifyApi.setRefreshToken(botconfig.SPOTIFY_REFRESH_TOKEN);

// After setting refresh token => refresh access token at initial bot start
refreshSpotifyToken();

// CronJob to refresh token at the top of every hour
let scheduleTokenRefresh = new cron.CronJob('00 59 * * * *', async () => {
    refreshSpotifyToken();
    console.log(`CronJob refreshed token at ${new Date().toLocaleTimeString()}`)
})
scheduleTokenRefresh.start();

// This is CLIENT CREDENTIALS FLOW FOR TWITCH 
// See https://dev.twitch.tv/docs/authentication#types-of-tokens for more info on Twitch OAuth
let twitchScopes = []
const getToken = (url, callback) => {
    //See https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-client-credentials-flow
    const options = {
        url: url,
        method: 'POST',
        json: true,
        body: {
            'client_id': botconfig.TWITCH_CLIENT_ID,
            'client_secret': botconfig.TWITCH_CLIENT_SECRET,
            'grant_type': 'client_credentials'
        }
    };

    request.post(options, (err, res, body) => {
        if (err) {
            return console.log(err);
        }
        console.log(`Status: ${res.statusCode}`);
        //console.log(body);

        callback(res);
    })
};
var twitchAT = ''; //OAuth App Access Token
getToken(botconfig.TWITCH_GET_TOKEN, (res) => {
    twitchAT = res.body.access_token;
    return twitchAT;
})

// Make a call to subscribe to follow EventSub WIP
const getFollowSubscription = (url, callback) => {
    //See https://dev.twitch.tv/docs/eventsub#create-a-subscription
    const options = {
        url: url,
        method: 'POST',
        json: true,
        headers: {
            'Client-ID': botconfig.TWITCH_CLIENT_ID,
            'Authorization': 'Bearer ' + twitchAT
        },
        body: {
            'type': "channel.follow",
            'version': "1",
            'condition': {
                'broadcaster_user_id': botconfig.TWITCH_BROADCASTER_ID // See https://dev.twitch.tv/docs/api/reference#get-users
            },
            'transport': {
                // Need way to receive notifications
            }
        }
    };

    request.post(options, (err, res, body) => {
        if (err) {
            return console.log(err);
        }
        console.log(`Status: ${res.statusCode}`);
        console.log(body);

        callback(res);
    })
};


let cooldown = 3000; // Set a cooldown between commands to prevent bot spam
let lastCommand = 0; // Tracks last command sent by bot


client.on('message', async (channel, userstate, message, self) => {
    if (self) return;

    let moderated = moderateTwitchChat(userstate, message, channel);
    if (moderated) return;

    if (cooldown - (Date.now() - lastCommand) > 0) return console.log("Too fast! Command usage on cooldown.");
    else lastCommand = Date.now();

    const greetings = ['Hi! How has your day been?', 'hey, how are you?', 'yo what\'s up', 'heya!', 'hey what\'s up?'];
    const rand_greeting = greetings[Math.floor(Math.random() * greetings.length)];

    const args = message.toLowerCase().split(' ');
    const comm = args[0];

    if (comm === '!hello') {
        client.say(channel, `@${userstate.username}, ${rand_greeting}`);
    } else if (comm === '!help') {
        const arr = ['!hello', '!settings', '!creationmeta', '!coinflip', '!queue', '!request', '!song'];
        const allComms = arr.join(", ");
        client.say(channel, `Here is a list of active commands: ${allComms}`);
    } else if (comm === '!flip' || comm === '!coinflip' || comm === '!flipcoin') {
        const rand = Math.floor(Math.random() * 2);
        if (rand == 0) {
            client.say(channel, `@${userstate.username} flips a coin and it's Heads!`)
        } else {
            client.say(channel, `@${userstate.username} flips a coin and it's Tails!`)
        }
    } else if (comm === '!queue' || comm === '!request' || comm === '!sr') {
        if (!args[1]) return client.say(channel, `@${userstate.username} you must specify a Spotify song name with this command!`)

        // THIS IS CLIENT CREDENTIALS FLOW FOR SPOTIFY (SUITABLE FOR BASIC INFO REQUESTS / NO USER AUTH)
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
            getSongURI(`https://api.spotify.com/v1/search?q=${args.slice(1).join("%20")}&type=track&limit=1&offset=0`, (res) => {
                if (JSON.parse(res.body).tracks.items.length == 0) return client.say(channel, `@${userstate.username}, could not find a song with that name`);
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
                    queue.push(songURI)
                }, 1000)
            })
        }, 1000)
    } else if (comm === '!skip') {
        if (!userstate.mod && userstate.username != botconfig.CHANNEL_NAME) return client.say(channel, `@${userstate.username}, sorry you don't have access to this command!`);

        const getCurr = (url, callback) => {
            // see https://developer.spotify.com/console/get-user-player/
            const songOptions = {
                url: `${url}`,
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
        };
        setTimeout(() => {
            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                var currData = JSON.parse(res.body);
                // console.log(currData)

                // If current song's context is null skip to last context or default context uri
                if (currData.context === null) {

                    // This plays the previously saved context (after a rewind) with a default context
                    if (lastContext === null) lastContext = botconfig.SPOTIFY_DEFAULT_CONTEXT;
                    const playContext = (url) => {
                        // see https://developer.spotify.com/console/put-play/

                        const songOptions = {
                            url: `${url}`,
                            method: "PUT",
                            json: true,
                            headers: {
                                'Authorization': 'Bearer ' + access_token
                            },
                            body: {
                                context_uri: lastContext //Resume play at last context
                            }
                        };
                        request.put(songOptions, (err, res, body) => {
                            if (err) {
                                return console.log(err);
                            }
                            console.log(`Status: ${res.statusCode}`);
                            console.log(body);

                        });
                    };
                    setTimeout(() => {
                        playContext(botconfig.SPOTIFY_PLAY_LINK)
                        setTimeout(() => {
                            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                                currData = JSON.parse(res.body);
                                var artistArr = [];
                                var song = '';
                                var artists = currData.item.artists;
                                for (var i = 0; i < artists.length; i++) {
                                    artistArr.push(artists[i].name);
                                }
                                artist = artistArr.join(", ");
                                song = currData.item.name;

                                client.say(channel, `@${userstate.username}, skipped current song. Now playing ${song} by ${artist}`);
                            })
                        }, 1000)
                    }, 1000)
                } else {
                    const skipCurr = (url) => {
                        // see https://developer.spotify.com/console/post-next/
                        const songOptions = {
                            url: `${url}?device_id=${botconfig.SPOTIFY_DEVICE_ID}`,
                            json: true,
                            headers: {
                                'Authorization': 'Bearer ' + access_token
                            }
                        };
                        request.post(songOptions, (err, res, body) => {
                            if (err) {
                                return console.log(err);
                            }
                            console.log(`Status: ${res.statusCode}`);
                            //console.log(body);

                        });
                    };
                    setTimeout(() => {
                        skipCurr(botconfig.SPOTIFY_SKIP_LINK)
                        setTimeout(() => {
                            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                                currData = JSON.parse(res.body);
                                var artistArr = [];
                                var song = '';
                                var artists = currData.item.artists;
                                for (var i = 0; i < artists.length; i++) {
                                    artistArr.push(artists[i].name);
                                }
                                artist = artistArr.join(", ");
                                song = currData.item.name;

                                client.say(channel, `@${userstate.username}, skipped current song. Now playing ${song} by ${artist}`);
                            })
                        }, 1000)
                    }, 1000)
                }
            })
        }, 1000)


    } else if (comm === '!prevous' || comm === '!back' || comm === '!prev' || comm === '!rewind') {
        if (!userstate.mod && userstate.username != botconfig.CHANNEL_NAME) return client.say(channel, `@${userstate.username}, sorry you don't have access to this command!`);

        let responses = ["put it in reverse terry!", "rewinding.", "going back!", "Great Scott!", "I feel like I've been here before."];
        let chosenOne = responses[Math.floor(Math.random() * responses.length)];

        const getCurr = (url, callback) => {
            // see https://developer.spotify.com/console/get-user-player/
            const songOptions = {
                url: `${url}`,
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
                //console.log(body);
                callback(res);
            });
        };

        // if songs in queue history play last queued, else go back one song in playback
        if (queue.length == 0) {
            const playPrev = (url) => {
                // see https://developer.spotify.com/console/post-previous/
                const songOptions = {
                    url: `${url}?device_id=${botconfig.SPOTIFY_DEVICE_ID}`,
                    json: true,
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    }
                };
                request.post(songOptions, (err, res, body) => {
                    if (err) {
                        return console.log(err);
                    }
                    console.log(`Status: ${res.statusCode}`);
                    console.log(body);
                    if (res.statusCode != 204) {
                        console.log("Error no previous song.")
                        client.say(channel, `@${userstate.username}, queue history empty and current song is start of playback.`)
                    } else {
                        console.log("Going to previous song")
                        setTimeout(() => {
                            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                                currData = JSON.parse(res.body);
                                var artistArr = [];
                                var song = '';
                                var artists = currData.item.artists;
                                for (var i = 0; i < artists.length; i++) {
                                    artistArr.push(artists[i].name);
                                }
                                artist = artistArr.join(", ");
                                song = currData.item.name;

                                client.say(channel, `@${userstate.username}, ${chosenOne} Now playing ${song} by ${artist}`);
                            })
                        }, 1000)
                    }
                });
            };
            setTimeout(() => {
                playPrev(botconfig.SPOTIFY_PREV_LINK)
            }, 1000)
        } else {

            var duration; // Used for when no context song is finished (move back to last context automatically)
            var poppedSong = queue.pop();
            setTimeout(() => {
                getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                    var currData = JSON.parse(res.body);
                    lastContext = currData.context;
                    if (lastContext === null) lastContext = botconfig.SPOTIFY_DEFAULT_CONTEXT;
                    else lastContext = currData.context.uri;

                    // This plays the previously queued song (queue array is LIFO)
                    const playPrev = (url) => {
                        // see https://developer.spotify.com/console/put-play/

                        const songOptions = {
                            url: `${url}`,
                            method: "PUT",
                            json: true,
                            headers: {
                                'Authorization': 'Bearer ' + access_token
                            },
                            body: {
                                uris: [poppedSong] //get last queued song
                            }
                        };
                        request.put(songOptions, (err, res, body) => {
                            if (err) {
                                return console.log(err);
                            }
                            console.log(`Status: ${res.statusCode}`);
                            console.log(body);

                        });
                    };

                    setTimeout(() => {
                        playPrev(botconfig.SPOTIFY_PLAY_LINK)
                        setTimeout(() => {
                            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                                currData = JSON.parse(res.body);
                                var artistArr = [];
                                var song = '';
                                var artists = currData.item.artists;
                                for (var i = 0; i < artists.length; i++) {
                                    artistArr.push(artists[i].name);
                                }
                                artist = artistArr.join(", ");
                                song = currData.item.name;
                                duration = currData.item.duration_ms;

                                client.say(channel, `@${userstate.username}, ${chosenOne} Now playing ${song} by ${artist}`);
                                console.log(`duration: ${duration}`)
                                // logic for when song ends (move to last context)
                                setTimeout(() => {
                                    getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                                        currData = JSON.parse(res.body);

                                        // if curr song is not the previously queued song, then continue as normal
                                        // else handle playback ensure transition from null context to last context
                                        if (currData.item.uri != poppedSong) return console.log("Nothing to do here.");
                                        else {
                                            // This plays the previously saved context (after a rewind) with a default context
                                            if (lastContext === null) lastContext = botconfig.SPOTIFY_DEFAULT_CONTEXT;
                                            console.log("Restoring last context.")
                                            const playContext = (url) => {
                                                // see https://developer.spotify.com/console/put-play/

                                                const songOptions = {
                                                    url: `${url}`,
                                                    method: "PUT",
                                                    json: true,
                                                    headers: {
                                                        'Authorization': 'Bearer ' + access_token
                                                    },
                                                    body: {
                                                        context_uri: lastContext //Resume play at last context
                                                    }
                                                };
                                                request.put(songOptions, (err, res, body) => {
                                                    if (err) {
                                                        return console.log(err);
                                                    }
                                                    console.log(`Status: ${res.statusCode}`);
                                                    console.log(body);

                                                });
                                            };
                                            setTimeout(() => {
                                                playContext(botconfig.SPOTIFY_PLAY_LINK)
                                            }, 1000)
                                        }
                                    })
                                }, duration - 1000)
                            })
                        }, 1000)
                    }, 1000)
                }, 1000)
            })
        }

    } else if (comm === '!song' || comm === '!playing') {

        const getCurr = (url, callback) => {
            // see https://developer.spotify.com/console/get-user-player/
            const songOptions = {
                url: `${url}`,
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
        };
        setTimeout(() => {
            getCurr(botconfig.SPOTIFY_CURR_LINK, (res) => {
                if (res.statusCode == 204) return client.say(channel, `Error parsing song.`);
                var currData = JSON.parse(res.body);

                if (currData.item === undefined || currData.is_playing == false) return client.say(channel, `@${userstate.username}, no song currently playing.`);

                const currSong = currData.item.name;
                const currArtist = currData.item.artists[0].name;
                const songLink = currData.item.external_urls.spotify;
                client.say(channel, `@${userstate.username}, current song is ${currSong} by ${currArtist} -> ${songLink}`);
            })
        }, 1000)
    } else if (comm === '!outro') {

        if (userstate.username != botconfig.CHANNEL_NAME) return client.say(channel, `@${userstate.username}, sorry you don't have access to this command!`);

        // This command is only usable by streamer
        // Thank viewers with chat msg and play a given outro song
        const playOutro = (url) => {
            // see https://developer.spotify.com/console/put-play/

            const songOptions = {
                url: `${url}`,
                method: "PUT",
                json: true,
                headers: {
                    'Authorization': 'Bearer ' + access_token
                },
                body: {
                    uris: [botconfig.SPOTIFY_OUTRO_SONG_URI] // Outro song URI
                }
            };
            request.put(songOptions, (err, res, body) => {
                if (err) {
                    return console.log(err);
                }
                console.log(`Status: ${res.statusCode}`);
                console.log(body);

            });
        };
        setTimeout(() => {
            playOutro(botconfig.SPOTIFY_PLAY_LINK);
            // Customize this outro message
            client.say(channel, `Thanks for coming out to the stream! Hope to see you again soon! Follows are appreciated as we are on the road to affiliate!`)
        }, 1000)
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

async function refreshSpotifyToken() {
    const data = await spotifyApi.refreshAccessToken();
    access_token = data.body['access_token'];

    console.log('The access token has been refreshed!');
    // console.log('access_token:', access_token);
    spotifyApi.setAccessToken(access_token);
}