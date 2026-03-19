const { createSession, getSession } = require("./whatsappManager")
const ffmpeg = require("fluent-ffmpeg")
const path = require("path")
const express = require("express")
const mongoose = require("mongoose")
const { MessageMedia } = require("whatsapp-web.js")
const multer = require("multer")

const Message = require("./models/Message")

const app = express()

app.use(express.json())
app.use(express.static("public"))

/* ==============================
   UPLOAD IMAGEM
================================ */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
})

const upload = multer({ storage })
app.use("/uploads", express.static("uploads"))

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

    const outputPath = inputPath.replace(".webm",".ogg")

    ffmpeg(inputPath)
    .audioCodec("libopus")
    .audioBitrate("64k")
    .audioChannels(1)
    .audioFrequency(48000)
    .format("ogg")
    .on("end",()=> resolve(outputPath))
    .on("error",(err)=> reject(err))
    .save(outputPath)

  })

}

/* ==============================
   AGENDAR MENSAGEM
================================ */

app.post("/schedule", upload.single("image"), async (req, res) => {

  const { userId, number, message, sendDate, recurring, audio } = req.body

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
    audio
  })

  await newMessage.save()

  res.send("Mensagem agendada!")

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

    for(let msg of messages){

      const client = getSession(msg.userId)

      if(!client){
        console.log("Sessão não encontrada:", msg.userId)
        continue
      }

      try{

        if(msg.audio){

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

/* ==============================
   UPLOAD AUDIO
================================ */

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "audios/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
})

const uploadAudio = multer({ storage: audioStorage })

app.post("/upload-audio", uploadAudio.single("audio"), (req, res) => {

  if(!req.file){
    return res.send("Nenhum áudio enviado")
  }

  res.json({
    audioPath: req.file.path
  })

})

/* ==============================
   CONTATOS (MULTI-SESSÃO)
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


const qrcode = require("qrcode-terminal") // garantir que está no topo

app.get("/connect/:sessionId", async (req,res)=>{

  const sessionId = req.params.sessionId

  const client = await createSession(sessionId)

  client.on("qr", qr=>{
    console.log("QR RECEIVED")
    qrcode.generate(qr, { small: true }) // 👈 ESSENCIAL
  })

  res.send("Sessão criada")

})


})
