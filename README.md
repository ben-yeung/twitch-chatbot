# twitch-chatbot
Simple chatbot to interact with users in Twitch chats and provide additional commands
- Uses [tmi.js](https://github.com/tmijs/tmi.js) for Twitch integration

## Spotify API Integration | [package](https://www.npmjs.com/package/spotify-web-api-node)
- Using Authorization Code Flow with various scopes to make GET and POST requests
- Twitch chat commands to add songs to streamer's spotify queue and skip songs (moderator permission granted)
- Command to grab song currently playing in real time
- Maintaining access and refresh tokens to ensure that requests can be made
- Examples of Client Credentials Flow and Authorization Code Flow
- Chaining requests and outputting relevant data to Twitch stream chat

## Debugging
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
