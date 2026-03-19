const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({

number: String,

message: String,

sendDate: Date,
image: String,
audio: String,
sent: {
type: Boolean,
default: false
},

recurring: {
type: Boolean,
default: false
}

})

module.exports = mongoose.model("Message", MessageSchema)
