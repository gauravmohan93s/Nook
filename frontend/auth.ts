import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.id_token = account.id_token
      }
      return token
    },
    async session({ session, token }) {
      // @ts-ignore
      session.id_token = token.id_token as string
      return session
    },
  },
  theme: {
    logo: "/logo.png",
  },
})