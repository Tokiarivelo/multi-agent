import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import axios from 'axios';

// Determine API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Call Gateway Service Login
          // Assuming gateway returns { accessToken: string, user: { ... } }
          const res = await axios.post(`${API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          if (res.data) {
            const user = res.data.user || {};
            // Ensure we return an object that matches User interface
            return {
              id: user.id || 'unknown',
              name: user.name || 'User',
              email: user.email || credentials.email,
              jwt: res.data.accessToken || res.data.token,
            };
          }
          return null;
        } catch (error) {
          console.error('Login failed:', error);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        if (account.provider === 'google' || account.provider === 'github') {
          try {
            // Split name into first and last
            const nameParts = (user.name || '').split(' ');
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.slice(1).join(' ') || 'Social';

            const res = await axios.post(`${API_URL}/auth/social-login`, {
              email: user.email,
              firstName,
              lastName,
              provider: account.provider,
              image: user.image,
            });

            if (res.data) {
              token.accessToken = res.data.accessToken;
              token.id = res.data.user.id;
              // Update user object in token if needed
              token.name = res.data.user.firstName + ' ' + res.data.user.lastName;
              token.picture = res.data.user.image;
            }
          } catch (error) {
            console.error('Social login failed', error);
            // Fallback or error handling?
            // If backend fails, we might still have next-auth session but no backend token.
          }
        } else {
          // Credentials provider
          token.accessToken = user.jwt;
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.accessToken = token.accessToken as string;
        session.user.id = token.id as string;
        // Optionally pass token to user object too if needed by client
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
