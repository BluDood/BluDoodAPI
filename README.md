# BluDoodAPI

My personal API, hosted at https://api.bludood.com.

## Features:

- Live fetching of current Spotify status including track, album, urls, images and more
- Live activity status from Discord
- Hosting of avatar with real-time resizing

## Setup:

1. Install node modules

```
npm install
```

2. Build TypeScript source

```
npm run build
```

3. Set up environment variables

All entries are optional, [here are guides to set them all up](https://github.com/BluDood/BluDoodAPI/wiki)

4. Start the API

```
npm start
```

## Notice

To enable real-time updates for Spotify (and no unnecessary spamming of their API), this uses some unofficial Spotify APIs, which could set your account at a risk of getting removed by Spotify. Use at your own risk.
