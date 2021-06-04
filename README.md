#  twitch-chatbot 🤖

[![Spotify API](https://img.shields.io/badge/Spotify%20API-Doc-brightgreen?style=for-the-badge&logo=spotify)](https://developer.spotify.com/documentation/web-api/quick-start/)
   [![Twitch API](https://img.shields.io/badge/Twitch%20API-Doc-blueviolet?style=for-the-badge&logo=twitch)](https://dev.twitch.tv/docs/)
   [![npm](https://img.shields.io/badge/npm-v7.15.1-red?style=for-the-badge&logo=npm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
   [![Node.js](https://img.shields.io/badge/Node.js-v16.3.0-brightgreen?style=for-the-badge&logo=Nodejs)](https://dev.twitch.tv/docs/)
   [![tmi.js](https://img.shields.io/badge/tmi.js-v1.8.0-blueviolet?style=for-the-badge)](https://github.com/tmijs/tmi.js)

## Simple chat bot to interact with users in Twitch chat and provide moderation
- Uses [tmi.js](https://github.com/tmijs/tmi.js) for Twitch integration
- Simple starter greeting command, flip coin command, and some relevant streamer information
- Some moderation features include automatic message deletion based on blacklist of words
    - Note that API / CLIENT keys and secrets are hidden in a botconfig.json file
    - This file also includes an array of blacklisted words (be sure to make your own for moderating)
    - Feel free to also use a .env file and change the respective botconfig references

##  🎧 Spotify Web API Integration
- Using Authorization Code Flow with various scopes to make GET and POST requests
- Twitch chat commands to modify playback (moderator permission options)
    - Command to grab song currently playing in real time
    - Command to skip current song
    - Command to add a song to Spotify queue
- Examples of Client Credentials Flow and Authorization Code Flow
    - Maintaining access and refresh tokens to ensure authorized requests
    - Chaining requests and outputting relevant data to Twitch stream chat
- Note that request urls are hidden in a botconfig.json file as some contain private information
    - Be sure to update or include the relevant url calls accordingly
- Once a refresh token has been generated, schedule access token refreshes with cron

##  🔎 Debugging 
**To get started with initializing a Twitch Chat Bot see:**
- [Quickstart Overview](https://dev.twitch.tv/docs/irc)
    - *Basic setup and starter code for a Twitch Chat Bot*
- [Message Tags](https://dev.twitch.tv/docs/irc/tags)
    - *See this to learn more on the metadata (userstate, roomstate, etc)*
- [Twitch API Reference](https://dev.twitch.tv/docs/api/reference)
    - *This is for the more in depth channel, analytics, games, etc functions*

**For more information on setting up Spotify API / Application see:**
- [Web API Quickstart](https://developer.spotify.com/documentation/web-api/quick-start/)
    - *Setting up an application with the Spotify Developer Dashboard*
- [Authorization Guide](https://developer.spotify.com/documentation/general/guides/authorization-guide/#authorization-code-flow)
    - *Some example requests for different Auth Flows based on needs (make sure to read more on scopes)*
- [Web API Reference](https://developer.spotify.com/documentation/web-api/reference/)
    - *I highly recommend this reference as there are browser API previews for GET/POST requests and request structure*
- Most of the calls have their relative Spotify API Doc links above them

## 🛠️ Dependencies 
- [request](https://www.npmjs.com/package/request)
- [express](https://www.npmjs.com/package/express)
- [spotify-web-api-node](https://www.npmjs.com/package/spotify-web-api-node)
- [esm](https://www.npmjs.com/package/esm)
- [base64](https://www.npmjs.com/package/base-64)
- [cron](https://www.npmjs.com/package/cron)
