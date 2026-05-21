import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import * as AuthSession from "expo-auth-session"
import * as Google from "expo-auth-session/providers/google"
import { router, useLocalSearchParams } from "expo-router"

const API = "http://150.162.57.138:3000"
const GOOGLE_ANDROID_CLIENT_ID = "427937023893-qc53u5s5i49g5ijgmr6t58k0se9ndb4m.apps.googleusercontent.com"

const getParam = (value: string | string[] | undefined) => {
  return Array.isArray(value) ? value[0] : value
}

export default function OAuthRedirect(){
  const params = useLocalSearchParams<{ code?: string; id_token?: string }>()
  const [message, setMessage] = useState("Finalizando login com Google...")

  useEffect(() => {
    const finishLogin = async () => {
      try {
        const code = getParam(params.code)
        let idToken = getParam(params.id_token)

        if (!idToken) {
          if (!code) {
            throw new Error("Google nao retornou codigo de login")
          }

          const authRequest = (globalThis as any).googleAuthRequest

          if (!authRequest?.codeVerifier || !authRequest?.redirectUri) {
            throw new Error("Sessao Google nao encontrada")
          }

          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: GOOGLE_ANDROID_CLIENT_ID,
              code,
              redirectUri: authRequest.redirectUri,
              extraParams: {
                code_verifier: authRequest.codeVerifier,
              },
            },
            Google.discovery
          )

          idToken = tokenResponse.idToken
        }

        if (!idToken) {
          throw new Error("Google nao retornou id_token")
        }

        const res = await fetch(`${API}/google-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: idToken }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || "Erro no login Google")
        }

        const data = await res.json()
        ;(globalThis as any).googleAuthResult = data
        setMessage("Logado com Google")
        setTimeout(() => router.replace("/"), 600)
      } catch (err) {
        console.log("Erro ao finalizar login Google:", err)
        setMessage("Nao foi possivel concluir o login com Google")
        setTimeout(() => router.replace("/"), 1500)
      }
    }

    finishLogin()
  }, [params.code, params.id_token])

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: {
    marginTop: 16,
    textAlign: "center",
  },
})
