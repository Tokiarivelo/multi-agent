import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      const { pathname } = req.nextUrl;
      if (
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/workflows') ||
        pathname.startsWith('/agents') ||
        pathname.startsWith('/fork-requests') ||
        pathname.startsWith('/invitations')
      ) {
        return token !== null;
      }
      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: ['/dashboard/:path*', '/workflows/:path*', '/agents/:path*', '/monitor/:path*', '/fork-requests/:path*', '/invitations/:path*'],
};
