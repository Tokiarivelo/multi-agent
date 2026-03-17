import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role?: string;
    } & DefaultSession['user'];
    accessToken: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string;
    firstName?: string;
    lastName?: string;
    /** Backend JWT returned by the credentials authorize() function */
    jwt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken: string;
    role?: string;
    picture?: string;
  }
}

