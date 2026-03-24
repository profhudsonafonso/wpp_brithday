import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState } from 'react'
import { useEffect } from 'react'

export default function App(){

  const [number, setNumber] = useState('')
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  
//busca de contatos

useEffect(() => {

  if(search.length < 2){
    setContacts([])
    return
  }

  const timeout = setTimeout(async () => {

    try{

      const response = await fetch(
        `${API}/contacts/search/user1?q=${search}`
      )

      const data = await response.json()

      setContacts(data)

    }catch(err){
      console.log(err)
    }

  }, 500) // ⏳ debounce

  return () => clearTimeout(timeout)

}, [search])


  const filteredContacts = contacts.filter(c =>
  c.name?.toLowerCase().includes(search.toLowerCase()) ||
  c.number.includes(search)
)

  const API = "http://150.162.57.138:3000"

  // 🔥 Enviar mensagem
  const sendMessage = async () => {

    try{

      const response = await fetch(
        `${API}/send-test/user1/${number}`
      )

      const text = await response.text()

      alert(text)

    }catch(err){
      alert("Erro ao enviar")
      console.log(err)
    }

  }

  
  // 🔥 Selecionar contato
  const selectContact = (num: string) => {
    setNumber(num)
  }

  return (
    <View style={styles.container}>

      <Text style={styles.title}>WhatsApp Scheduler</Text>

      {/* INPUT NÚMERO */}
      <TextInput
        style={styles.input}
        placeholder="Número (5511999999999)"
        value={number}
        onChangeText={setNumber}
      />

      {/* INPUT MENSAGEM */}
      <TextInput
        style={styles.input}
        placeholder="Mensagem"
        value={message}
        onChangeText={setMessage}
      />

      {/* BOTÕES */}
      <Button title="Enviar mensagem" onPress={sendMessage}/>
      <View style={{ marginVertical: 10 }}/>
      
      <TextInput
        style={styles.input}
        placeholder="Buscar contato..."
        value={search}
        onChangeText={setSearch}
      />
      
      {/* LISTA DE CONTATOS */}
      <ScrollView style={styles.contactList}>

        {filteredContacts.map((c, index) => (
          <TouchableOpacity
            key={index}
            style={styles.contactItem}
            onPress={() => selectContact(c.number)}
          >
            <Text style={styles.contactName}>
              {c.name}
            </Text>
            <Text style={styles.contactNumber}>
              {c.number}
            </Text>
          </TouchableOpacity>
        ))}

      </ScrollView>

    </View>
  )

}

const styles = StyleSheet.create({
  container:{
    flex:1,
    padding:20,
    marginTop:40
  },
  title:{
    fontSize:22,
    marginBottom:20,
    fontWeight:'bold'
  },
  input:{
    borderWidth:1,
    marginBottom:10,
    padding:10,
    borderRadius:8
  },
  contactList:{
    marginTop:20
  },
  contactItem:{
    padding:10,
    borderBottomWidth:1,
    borderColor:"#ddd"
  },
  contactName:{
    fontSize:16,
    fontWeight:'bold'
  },
  contactNumber:{
    fontSize:14,
    color:'gray'
  }
})