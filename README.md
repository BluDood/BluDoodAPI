# BluDoodAPI

My personal API, hosted at https://api.bludood.com.

## Features:

- Live fetching of current Spotify status including track, album, urls, images and more
- Live activity status from Discord
- Hosting of avatar with real-time resizing
- Contact form with notifications via Discord

## Setup

[Set up environment variables for the features you want available](https://github.com/BluDood/BluDoodAPI/wiki). Everything is optional.

## Running with Docker (recommended):

You must have the Docker Engine installed, and optionally Docker Compose.

### `docker run`

1. Build the image

   ```bash
   docker build . -t bludoodapi
   ```

2. Run the image
   ```bash
   docker run -p 1337:1337 --env-file .env bludoodapi
   ```

### `docker compose`

1. Create a compose.yml

   ```yml
   services:
     bludoodapi:
       build: .
       restart: unless-stopped
       ports:
         - '1337:1337'
       env_file: .env
   ```

2. Build and run the image
   ```bash
   docker compose up --build
   ```

## Running with Node:

1. Install node modules

   ```bash
   npm install
   ```

2. Build TypeScript source

   ```bash
   npm run build
   ```

3. Start the API
   ```bash
   npm start
   ```

## Development

1. Install node modules
   ```bash
   npm install
   ```
2. Start the server in development mode
   ```bash
   npm run dev
   ```

The server will now compile and restart the server when you edit a file.

## Notice

To enable real-time updates for Spotify (and no unnecessary spamming of their API), this uses some unofficial Spotify APIs, which could set your account at a risk of getting removed by Spotify. Use at your own risk.
