const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  sendDate: {
    type: Date,
    required: true
  },
  recurring: {
    type: Boolean,
    default: false
  },
  image: {
    type: String
  },
  audio: {
    type: String
  },
  sent: {
    type: Boolean,
    default: false
  }
})

module.exports = mongoose.model("Message", MessageSchema)