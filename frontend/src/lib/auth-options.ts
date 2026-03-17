import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import axios from 'axios';

// Gateway listens at /api (global prefix). 
// NEXT_PUBLIC_API_URL is now e.g. http://localhost:3000 (no /api suffix in .env)
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
          // Gateway auth endpoint — now explicitly including /api prefix
          const res = await axios.post(`${API_URL}/api/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          if (res.data) {
            const { accessToken, user } = res.data;
            return {
              id: user.id,
              email: user.email,
              name: `${user.firstName} ${user.lastName}`.trim(),
              firstName: user.firstName,
              lastName: user.lastName,
              image: user.image ?? null,
              role: user.role,
              jwt: accessToken,
            };
          }
          return null;
        } catch (error) {
          console.error('[NextAuth] Credentials login failed:', error);
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
      // On initial sign-in, `user` and `account` are present
      if (account && user) {
        if (account.provider === 'google' || account.provider === 'github') {
          try {
            const nameParts = (user.name || '').split(' ');
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.slice(1).join(' ') || 'Social';

            const res = await axios.post(`${API_URL}/api/auth/social-login`, {
              email: user.email,
              firstName,
              lastName,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              image: user.image,
            });

            if (res.data) {
              token.accessToken = res.data.accessToken;
              token.id = res.data.user.id;
              token.role = res.data.user.role;
              token.picture = res.data.user.image ?? user.image;
              token.name = `${res.data.user.firstName} ${res.data.user.lastName}`.trim();
            }
          } catch (error) {
            console.error('[NextAuth] Social login backend call failed:', error);
            // Propagate the error so NextAuth surfaces it on the callback page
            throw new Error('social_login_failed');
          }
        } else {
          // Credentials provider — user object returned from authorize()
          token.accessToken = user.jwt!;
          token.id = user.id;
          token.role = user.role;
          token.picture = user.image ?? undefined;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.accessToken = token.accessToken as string;
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.image = (token.picture as string) ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // Redirect OAuth errors back to login page with ?error=...
  },

  secret: process.env.NEXTAUTH_SECRET,
};

