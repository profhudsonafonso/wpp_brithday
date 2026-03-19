const { createSession, getSession } = require("./whatsappManager")
const ffmpeg = require("fluent-ffmpeg")
const path = require("path")
const express = require("express")
const mongoose = require("mongoose")
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const qrcode = require("qrcode-terminal")
const multer = require("multer")


const Message = require("./models/Message")

const app = express()

app.use(express.json())
app.use(express.static("public"))

/* ==============================
   CONFIGURAÇÃO DO UPLOAD
================================ */

const storage = multer.diskStorage({

destination: function (req, file, cb) {
cb(null, "uploads/")
},

filename: function (req, file, cb) {
cb(null, Date.now() + path.extname(file.originalname))
}

})

const upload = multer({ storage: storage })

app.use("/uploads", express.static("uploads"))

/* ==============================
   MONGODB
================================ */

mongoose.connect("mongodb://mongodb:27017/whatsapp_scheduler")
.then(() => console.log("MongoDB conectado"))
.catch(err => console.log(err))

/* ==============================
   WHATSAPP CLIENT
================================ */

const client = new Client({

authStrategy: new LocalAuth({
dataPath: "./sessions"
}),

puppeteer: {
executablePath: "/usr/bin/chromium",
headless: true,
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
"--disable-features=site-per-process"
]
}

})

client.on("qr", (qr) => {

console.log("QR RECEIVED")
qrcode.generate(qr, { small: true })

})

client.on("ready", () => {
console.log("WhatsApp conectado!")
})

client.on("auth_failure", msg => {
console.error("Erro de autenticação:", msg)
})

client.on("disconnected", reason => {
console.log("WhatsApp desconectado:", reason)
})

client.initialize()

/* ==============================
   SERVIDOR
================================ */

app.listen(3000, () => {
console.log("Servidor rodando na porta 3000")
})

/* ==============================
   TESTE DE ENVIO
================================ */


app.get("/send-test/:sessionId/:number", async (req, res) => {

try {

const { sessionId, number } = req.params

const client = getSession(sessionId)

if(!client){
return res.send("Sessão não encontrada")
}

await client.sendMessage(number + "@c.us", "Mensagem teste")

res.send("Mensagem enviada!")

} catch (error) {

console.log(error)
res.send("Erro ao enviar mensagem")

}

})

//função de conversão de áudio

function convertAudio(inputPath){

return new Promise((resolve,reject)=>{

const outputPath = inputPath.replace(".webm",".ogg")

ffmpeg(inputPath)
.audioCodec("libopus")
.audioBitrate("64k")
.audioChannels(1)
.audioFrequency(48000)
.format("ogg")
.on("end",()=>{
console.log("Áudio convertido:", outputPath)
resolve(outputPath)
})
.on("error",(err)=>{
console.log("Erro ao converter:", err)
reject(err)
})
.save(outputPath)

})

}
/* ==============================
   AGENDAR MENSAGEM
================================ */

app.post("/schedule", upload.single("image"), async (req, res) => {

const {userId, number, message, sendDate, recurring, audio } = req.body

let imagePath = null

if(req.file){
imagePath = req.file.path
}

const formattedNumber = number.replace(/\D/g,'') + "@c.us"

const newMessage = new Message({
userId,
number: formattedNumber,
message,
sendDate,
recurring,
image: imagePath,
audio: audio

})

await newMessage.save()

res.send("Mensagem agendada!")

})
/* ==============================
   SCHEDULER AUTOMÁTICO
================================ */

setInterval(async ()=>{

try{

const messages = await Message.find({
sent:false,
sendDate:{$lte:new Date()}
})

for(let msg of messages){

const client = getSession(msg.userId)

if(!client){
console.log("Sessão não encontrada:", msg.userId)
continue
}

try{

if(msg.audio){

console.log("Enviando áudio:", msg.audio)

const convertedAudio = await convertAudio(msg.audio)

const media = MessageMedia.fromFilePath(convertedAudio)

await client.sendMessage(msg.number, media, {
sendAudioAsVoice: true
})

}
else if(msg.image){

const media = MessageMedia.fromFilePath(msg.image)

await client.sendMessage(msg.number, media, {
caption: msg.message
})

}
else{

await client.sendMessage(msg.number, msg.message)

}

if(msg.recurring){

const nextYear = new Date(msg.sendDate)
nextYear.setFullYear(nextYear.getFullYear() + 1)

msg.sendDate = nextYear
msg.sent = false

}else{

msg.sent = true

}

await msg.save()

console.log("Mensagem enviada para:", msg.number)

}catch(err){
console.log("Erro ao enviar:", err)
}

}

}catch(err){
console.log("Erro geral:", err)
}

},5000)

/* ==============================
   LISTAR MENSAGENS
================================ */

app.get("/messages", async (req, res) => {

try {

const messages = await Message.find().sort({ sendDate: 1 })

res.json(messages)

} catch (error) {

console.log(error)
res.send("Erro ao buscar mensagens")

}

})


// configrando envio de audio

const audioStorage = multer.diskStorage({

destination: function (req, file, cb) {
cb(null, "audios/")
},

filename: function (req, file, cb) {
cb(null, Date.now() + path.extname(file.originalname))
}

})

const uploadAudio = multer({ storage: audioStorage })

//rota de audio

app.post("/upload-audio", uploadAudio.single("audio"), (req, res) => {

if(!req.file){
return res.send("Nenhum áudio enviado")
}

res.json({
audioPath: req.file.path
})

})

// acessar os contatos do whatasapp
app.get("/contacts", async (req, res) => {

try{

const contacts = await client.getContacts()

const formatted = await Promise.all(
contacts
.filter(c => 
c.isUser && 
c.id.server === "c.us" &&
c.number
)
.map(async c => {

let photo = null

try{
photo = await client.getProfilePicUrl(c.id._serialized)
}catch(e){}

return {
name: c.pushname || c.name || c.number,
number: c.number,
photo: photo
}

})
)
res.json(formatted)

}catch(err){

console.log(err)
res.status(500).send("Erro ao buscar contatos")

}

})


//rota para conectar whatsapp

app.get("/connect/:sessionId", async (req,res)=>{

const sessionId = req.params.sessionId

const client = await createSession(sessionId)

client.on("qr", qr=>{
console.log("QR:",qr)
})

res.send("Sessão criada")

})
