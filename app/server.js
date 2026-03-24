process.on("uncaughtException", (err) => {
  console.log("Erro não tratado:", err.message)
})

process.on("unhandledRejection", (err) => {
  console.log("Promise rejeitada:", err)
})

const { createSession, getSession } = require("./whatsappManager")
const ffmpeg = require("fluent-ffmpeg")
const path = require("path")
const express = require("express")
const mongoose = require("mongoose")
const { MessageMedia } = require("whatsapp-web.js")
const multer = require("multer")
const qrcode = require("qrcode-terminal")

const Message = require("./models/Message")

const app = express()

app.use(express.json())
app.use(express.static("public"))

/* ==============================
   UPLOAD (IMAGEM + AUDIO)
================================ */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {

    if(file.fieldname === "audio"){
      cb(null, "audios/")
    } else {
      cb(null, "uploads/")
    }

  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({ storage })

app.use("/uploads", express.static("uploads"))
app.use("/audios", express.static("audios"))

/* ==============================
   MONGODB
================================ */

mongoose.connect("mongodb://mongodb:27017/whatsapp_scheduler")
.then(() => console.log("MongoDB conectado"))
.catch(err => console.log(err))

/* ==============================
   SERVIDOR
================================ */

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000")
})

/* ==============================
   TESTE ENVIO
================================ */

app.get("/send-test/:sessionId/:number", async (req, res) => {

  try {

    const { sessionId, number } = req.params
    const client = getSession(sessionId)

    if (!client) {
      return res.send("Sessão não encontrada")
    }

    await client.sendMessage(number + "@c.us", "Mensagem teste")

    res.send("Mensagem enviada!")

  } catch (error) {
    console.log(error)
    res.send("Erro ao enviar mensagem")
  }

})

/* ==============================
   CONVERTER AUDIO
================================ */

function convertAudio(inputPath){

  return new Promise((resolve,reject)=>{

    const tempWav = inputPath + ".wav"
    const outputPath = inputPath + ".ogg"

    // 🔥 PASSO 1: m4a → wav (normaliza)
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(48000)
      .format("wav")
      .on("end",()=>{

        console.log("Convertido para WAV")

        // 🔥 PASSO 2: wav → ogg (voice)
        ffmpeg(tempWav)
          .audioCodec("libopus")
          .audioBitrate("64k")
          .audioChannels(1)
          .audioFrequency(48000)
          .format("ogg")
          .on("end",()=>{
            console.log("Áudio final:", outputPath)
            resolve(outputPath)
          })
          .on("error",(err)=>{
            console.log("Erro etapa 2:", err)
            reject(err)
          })
          .save(outputPath)

      })
      .on("error",(err)=>{
        console.log("Erro etapa 1:", err)
        reject(err)
      })
      .save(tempWav)

  })

}
/* ==============================
   AGENDAR MENSAGEM (FIXED)
================================ */

app.post("/schedule", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "audio", maxCount: 1 }
]), async (req, res) => {

  try{

    const userId = req.body.userId || "user1"
    const number = req.body.number
    const message = req.body.message
    const sendDateRaw = req.body.sendDate
    const recurring = req.body.recurring

    let imagePath = null
    let audioPath = null

    if(req.files?.image){
      imagePath = req.files.image[0].path
    }

    if(req.files?.audio){
      audioPath = req.files.audio[0].path
    }

    const formattedNumber = number.replace(/\D/g,'') + "@c.us"

    const sendDate = new Date(sendDateRaw)

    console.log("📅 Recebido:", sendDateRaw)
    console.log("📅 Convertido:", sendDate)
    console.log("🕒 Agora:", new Date())

    // 🔥 PROTEÇÃO: não permite enviar no passado
    if(sendDate <= new Date()){
      return res.status(400).send("Data deve ser futura")
    }

    const newMessage = new Message({
      userId,
      number: formattedNumber,
      message,
      sendDate,
      recurring,
      image: imagePath,
      audio: audioPath,
      sent: false
    })

    await newMessage.save()

    res.send("Mensagem agendada!")

  }catch(err){
    console.log("Erro no schedule:", err)
    res.status(500).send("Erro ao agendar")
  }

})
/* ==============================
   SCHEDULER
================================ */

setInterval(async ()=>{

  try{

    const messages = await Message.find({
      sent:false,
      sendDate:{$lte:new Date()}
    })
    console.log("Buscando mensagens...")
    console.log("Encontradas:", messages.length)
    
    for(let msg of messages){

      const client = getSession(msg.userId)

      if(!client){
        console.log("Sessão não encontrada:", msg.userId)
        continue
      }

      try{

        // 🔥 1. ENVIA TEXTO PRIMEIRO (SE EXISTIR)
        
        const now = new Date()

        // margem de segurança de 1 minuto
        if(msg.sendDate.getTime() < now.getTime() - 60000){
          return res.status(400).send("Data inválida (passado)")
        }
        if(msg.message){
          await client.sendMessage(msg.number, msg.message)
        }

        // 🔥 2. ENVIA IMAGEM
        if(msg.image){
          const media = MessageMedia.fromFilePath(msg.image)

          await client.sendMessage(msg.number, media, {
            caption: msg.message || ""
          })
        }

        // 🔥 3. ENVIA ÁUDIO
        if(msg.audio){

          const convertedAudio = await convertAudio(msg.audio)

          const media = MessageMedia.fromFilePath(convertedAudio)

          await client.sendMessage(msg.number, media, {
          sendAudioAsVoice: true
        })
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

/* ==============================
   CONTATOS
================================ */

app.get("/contacts/:sessionId", async (req, res) => {

  try{

    const client = getSession(req.params.sessionId)

    if(!client){
      return res.status(400).send("Sessão não encontrada")
    }

    const contacts = await client.getContacts()

    const formatted = await Promise.all(
      contacts
      .filter(c => c.isUser && c.id.server === "c.us" && c.number)
      .map(async c => {

        let photo = null

        try{
          photo = await client.getProfilePicUrl(c.id._serialized)
        }catch(e){}

        return {
          name: c.pushname || c.name || c.number,
          number: c.number,
          photo
        }

      })
    )

    res.json(formatted)

  }catch(err){
    console.log(err)
    res.status(500).send("Erro ao buscar contatos")
  }

})

/* ==============================
   BUSCA CONTATOS
================================ */

app.get("/contacts/search/:sessionId", async (req, res) => {

  try{

    const { sessionId } = req.params
    const q = (req.query.q || "").toLowerCase()

    const client = getSession(sessionId)

    if(!client){
      return res.status(400).send("Sessão não encontrada")
    }

    const contacts = await client.getContacts()

    const filtered = contacts
      .filter(c => {
        const name = (c.pushname || c.name || "").toLowerCase()
        const number = c.number || ""

        return (
          c.isUser &&
          c.id.server === "c.us" &&
          (name.includes(q) || number.includes(q))
        )
      })
      .slice(0, 20)

    const result = filtered.map(c => ({
      name: c.pushname || c.name || c.number,
      number: c.number
    }))

    res.json(result)

  }catch(err){
    console.log(err)
    res.status(500).send("Erro na busca")
  }

})

/* ==============================
   CONECTAR WHATSAPP
================================ */

app.get("/connect/:sessionId", async (req,res)=>{

  const sessionId = req.params.sessionId

  const client = await createSession(sessionId)

  client.on("qr", qr=>{
    console.log("QR RECEIVED")
    qrcode.generate(qr, { small: true })
  })

  res.send("Sessão criada")

})