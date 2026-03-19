const express = require("express")
const router = express.Router()

const Message = require("../models/Message")

// criar nova mensagem
router.post("/", async (req, res) => {

  try {

    const message = new Message(req.body)

    await message.save()

    res.json(message)

  } catch (err) {

    res.status(500).json({error: err.message})

  }

})

// listar mensagens
router.get("/", async (req, res) => {

  const messages = await Message.find()

  res.json(messages)

})

module.exports = router
