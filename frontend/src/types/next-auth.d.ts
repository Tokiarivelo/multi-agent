import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      accessToken: string;
    } & DefaultSession['user'];
    accessToken: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    jwt: string; // Assuming gateway returns jwt
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken: string;
  }
}
