import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.id_token = account.id_token
        token.access_token = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.id_token = token.id_token as string
      session.access_token = token.access_token as string
      return session
    },
  },
  theme: {
    logo: "/logo.png",
  },
})
