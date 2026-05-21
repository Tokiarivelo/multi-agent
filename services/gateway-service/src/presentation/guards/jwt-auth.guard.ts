import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Paths that must be reachable by unauthenticated users (invitation pre-flight)
    const req = context.switchToHttp().getRequest<{ path: string }>();
    const PUBLIC_PATHS = ['/api/workflows/invitations/by-token', '/api/auth/invitation-preview'];
    if (PUBLIC_PATHS.includes(req.path)) return true;

    return super.canActivate(context);
  }
}
