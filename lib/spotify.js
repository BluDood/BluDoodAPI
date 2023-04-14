const http = require('http')

const config = {
  client_id: null,
  client_secret: null,
  code: null
}

function readline() {
  return new Promise(resolve => {
    process.stdin.once('data', d => resolve(d.toString().trim()))
  })
}

const server = http.createServer()

async function waitForCode() {
  return new Promise(r => {
    server.once('request', req => r(new URL(req.url, 'http://whatever').searchParams.get('code')))
  })
}

async function startServer() {
  return new Promise(r => server.listen(1337, r))
}

async function getRefreshToken() {
  const req = await fetch(`https://accounts.spotify.com/api/token?grant_type=authorization_code&code=${config.code}&redirect_uri=http://localhost:1337`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  const json = await req.json()
  return json.refresh_token
}

;(async () => {
  console.log('Welcome! This script will guide you through the process of generating a Spotify Refresh Token for using this API.')
  console.log('Firstly, visit https://developer.spotify.com/dashboard and create an application. The redirect URI should be http://localhost:1337')
  console.log('Press Enter to continue...')
  await readline()
  process.stdout.write('Please enter the Client ID: ')
  config.client_id = await readline()
  process.stdout.write('Please enter the Client Secret: ')
  config.client_secret = await readline()
  console.log('Starting web server...')
  await startServer()
  console.log('Please authorize the application using this URL:')
  console.log(`https://accounts.spotify.com/authorize?response_type=code&client_id=${config.client_id}&scope=user-read-currently-playing&redirect_uri=http://localhost:1337`)
  config.code = await waitForCode()
  console.log('Done!')
  server.close()
  console.log('Getting refresh token...')
  const token = await getRefreshToken()
  console.log(token)
  console.log('Done! Please use the above token as the SPOTIFY_REFRESH_TOKEN environment variable in the API.')
  process.exit()
})()
