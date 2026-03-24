const { Client, LocalAuth } = require("whatsapp-web.js")

const sessions = {}

async function createSession(sessionId){

if(sessions[sessionId]) return sessions[sessionId]

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: sessionId,
    dataPath: "./sessions"
  }),

  webVersionCache: {
    type: "none"
  },

  puppeteer: {
    executablePath: "/usr/bin/chromium",
    headless: true,
    timeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--mute-audio",
      "--no-first-run",
      "--disable-web-security"
    ]
  }
})


// 🔥 ESSENCIAL: esperar estabilizar
client.on("ready", () => {
  console.log("WhatsApp conectado!")
})

client.on("loading_screen", (percent, message) => {
  console.log("Carregando:", percent, message)
})

client.on("qr", qr => {
  console.log("QR RECEIVED")
})


client.initialize()

sessions[sessionId] = client

return client

}

function getSession(sessionId){
return sessions[sessionId]
}

module.exports = { createSession, getSession }
