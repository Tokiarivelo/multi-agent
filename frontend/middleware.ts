import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized({ req, token }) {
      if (
        req.nextUrl.pathname.startsWith('/dashboard') ||
        req.nextUrl.pathname.startsWith('/workflows') ||
        req.nextUrl.pathname.startsWith('/agents') ||
        req.nextUrl.pathname.startsWith('/fork-requests') ||
        req.nextUrl.pathname.startsWith('/invitations')
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
