const { Client, LocalAuth } = require("whatsapp-web.js")

const sessions = {}

async function createSession(sessionId){

if(sessions[sessionId]) return sessions[sessionId]

const client = new Client({
authStrategy: new LocalAuth({
clientId: sessionId,
dataPath: ".sessions"
}),
puppeteer:{
headless:true,
args:[
"--no-sandbox",
"--disable-setuid-sandbox"
]
}
})

client.initialize()

sessions[sessionId] = client

return client

}

function getSession(sessionId){
return sessions[sessionId]
}

module.exports = { createSession, getSession }
