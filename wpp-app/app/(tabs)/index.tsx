import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native'
import { useState, useEffect } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'

export default function App(){

  const API = "http://150.162.57.138:3000"

  const [number, setNumber] = useState('')
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const [date, setDate] = useState(new Date())
  const [showDate, setShowDate] = useState(false)
  const [showTime, setShowTime] = useState(false)

  const [image, setImage] = useState<string | null>(null)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [audio, setAudio] = useState<string | null>(null)
  //const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)


  /* ==============================
     BUSCA
  ============================== */

  useEffect(() => {

    if(search.length < 2){
      setContacts([])
      return
    }

    const timeout = setTimeout(async () => {

      try{
        const res = await fetch(`${API}/contacts/search/user1?q=${search}`)
        const data = await res.json()
        setContacts(data)
      }catch(err){
        console.log(err)
      }

    }, 500)

    return () => clearTimeout(timeout)

  }, [search])

  /* ==============================
     IMAGEM
  ============================== */

  const pickImage = async () => {

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    })

    if (!result.canceled) {
      setImage(result.assets[0].uri)
    }

  }

  /* ==============================
     AUDIO
  ============================== */

  const startRecording = async () => {
  try {

    // 🔥 EVITA DUPLICAR GRAVAÇÃO
    if (recording) {
      console.log("Já está gravando")
      return
    }

    console.log("Pedindo permissão...")

    const permission = await Audio.requestPermissionsAsync()

    if (permission.status !== "granted") {
      alert("Permissão negada")
      return
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true
    })

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )

    setRecording(newRecording)

    console.log("Gravando...")

  } catch (err) {
    console.log("Erro ao iniciar gravação:", err)
  }
}

  const stopRecording = async () => {
  try {

    if (!recording) {
      console.log("Nada para parar")
      return
    }

    console.log("Parando gravação...")

    await recording.stopAndUnloadAsync()

    const uri = recording.getURI()

    setAudio(uri || null)
    setRecording(null)

    console.log("Áudio salvo:", uri)

  } catch (err) {
    console.log("Erro ao parar:", err)
  }
}
  /* ==============================
     ENVIAR
  ============================== */

  const sendMessage = async () => {

    try{

      const formData = new FormData()

      formData.append("userId", "user1")
      formData.append("number", number)
      formData.append("message", message)
      formData.append("sendDate",date.toISOString())
      formData.append("recurring", "false")

      if(image){
        formData.append("image", {
          uri: image,
          name: "image.jpg",
          type: "image/jpeg"
        } as any)
      }

      if(audio){
        formData.append("audio", {
          uri: audio,
          name: "audio.m4a",
          type: "audio/m4a"
        } as any)
      }

      const res = await fetch(`${API}/schedule`, {
        method: "POST",
        body: formData
      })

      const text = await res.text()
      alert(text)

    }catch(err){
      console.log(err)
      alert("Erro")
    }

  }

  const selectContact = (num: string) => setNumber(num)

  return (
    <View style={styles.container}>

      <Text style={styles.title}>WhatsApp Scheduler</Text>

      <TextInput style={styles.input} placeholder="Número" value={number} onChangeText={setNumber}/>
      <TextInput style={styles.input} placeholder="Mensagem" value={message} onChangeText={setMessage}/>

      {/* DATA */}
      <Button title="Selecionar Data" onPress={() => setShowDate(true)} />
      <Button title="Selecionar Hora" onPress={() => setShowTime(true)} />

      {showDate && (
        <DateTimePicker
          value={date}
          mode="datetime"
          onChange={(e,d)=>{
            setShowDate(false)
            if(d) setDate(d)
          }}
        />
      )}

      {showTime && (
        <DateTimePicker
          value={date}
          mode="time"
          onChange={(e,d)=>{
            setShowTime(false)
            if(d) setDate(d)
          }}
        />
      )}

      <Text>{date.toLocaleString()}</Text>

      {/* IMAGEM */}
      <Button title="Selecionar imagem" onPress={pickImage} />
      {image && <Image source={{uri:image}} style={styles.preview}/>}

      {/* AUDIO */}
      <Button
        title="Gravar áudio"
        onPress={startRecording}
        disabled={!!recording}
      />

      <Button
        title="Parar gravação"
        onPress={stopRecording}
        disabled={!recording}
      />
      <Text>{recording ? "🔴 Gravando..." : audio ? "✅ Áudio pronto" : ""}</Text>

      <Button title="Enviar" onPress={sendMessage}/>

      {/* BUSCA */}
      <TextInput style={styles.input} placeholder="Buscar..." value={search} onChangeText={setSearch}/>

      <ScrollView>
        {contacts.map((c,i)=>(
          <TouchableOpacity key={i} style={styles.contactItem} onPress={()=>selectContact(c.number)}>
            <Image source={{uri:c.photo || "https://via.placeholder.com/50"}} style={styles.avatar}/>
            <View>
              <Text>{c.name}</Text>
              <Text>{c.number}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container:{flex:1,padding:20,marginTop:40},
  title:{fontSize:22,fontWeight:'bold',marginBottom:20},
  input:{borderWidth:1,marginBottom:10,padding:10,borderRadius:8},
  contactItem:{flexDirection:'row',padding:10},
  avatar:{width:50,height:50,borderRadius:25,marginRight:10},
  preview:{width:100,height:100,marginVertical:10}
})