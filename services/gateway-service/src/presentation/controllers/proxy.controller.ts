import {
  Controller,
  All,
  Req,
  Res,
  Next,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { ConfigService } from '@nestjs/config';
import { appendFileSync } from 'fs';
import { Public } from '../decorators/public.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private proxyMiddleware: any;

  constructor(private configService: ConfigService) {
    this.proxyMiddleware = createProxyMiddleware({
      target: 'http://default-target', // Dummy target
      changeOrigin: true,
      router: (req) => {
        const segments = (req.url || '').split('?')[0].split('/').filter(Boolean);
        const service = segments[1];

        let target = '';
        switch (service) {
          case 'workflows':
          case 'orchestration':
          case 'workspace':
            target = this.configService.get<string>(
              'ORCHESTRATION_SERVICE_URL',
              'http://localhost:3003',
            );
            break;
          case 'agents':
            target = this.configService.get<string>('AGENT_SERVICE_URL', 'http://localhost:3002');
            break;
          case 'executions':
            target = this.configService.get<string>(
              'EXECUTION_SERVICE_URL',
              'http://localhost:3004',
            );
            break;
          case 'models':
          case 'api-keys':
            target = this.configService.get<string>('MODEL_SERVICE_URL', 'http://localhost:3005');
            break;
          case 'tools':
            target = this.configService.get<string>('TOOL_SERVICE_URL', 'http://localhost:3006');
            break;
          case 'vectors':
          case 'collections':
            target = this.configService.get<string>('VECTOR_SERVICE_URL', 'http://localhost:3007');
            break;
          case 'files':
            target = this.configService.get<string>('FILE_SERVICE_URL', 'http://localhost:3008');
            break;
          case 'github':
            target = this.configService.get<string>(
              'GITHUB_MCP_SERVICE_URL',
              'http://localhost:3010',
            );
            break;
          case 'mcp':
            target = this.configService.get<string>(
              'GITHUB_MCP_SERVICE_URL',
              'http://localhost:3010',
            );
            break;
          case 'trello':
            target = this.configService.get<string>(
              'TRELLO_MCP_SERVICE_URL',
              'http://localhost:3011',
            );
            break;
          case 'auth':
            target = this.configService.get<string>(
              'FRONTEND_SERVICE_URL',
              'http://localhost:3001',
            );
            break;
        }
        return target;
      },
      on: {
        proxyReq: (proxyReq, req: any) => {
          const contentType = req.headers['content-type'];
          if (contentType && contentType.includes('multipart/form-data')) {
            // Skip fixRequestBody for multipart to prevent corruption
            return;
          }
          return fixRequestBody(proxyReq, req);
        },
      },
    });
  }

  @Public()
  @All('auth/*')
  proxyAuth(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const segments = req.path.split('/').filter(Boolean);
    const service = segments[1];

    if (service === 'auth') {
      // List of native AuthController routes that stay in the gateway
      const nativeAuthRoutes = ['login', 'register', 'social-login', 'me'];
      if (nativeAuthRoutes.includes(segments[2])) {
        return next();
      }

      // Otherwise, proxy to the frontend (e.g., NextAuth session/log)
      return this.proxyMiddleware(req as any, res as any, next);
    }

    return next();
  }

  @Public()
  @All(['health', 'docs'])
  proxyPublicNative(@Next() next: NextFunction) {
    return next();
  }

  @Public()
  @All('github/*')
  proxyGithub(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyMiddleware(req as any, res as any, next);
  }

  @Public()
  @All('mcp')
  proxyMcp(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyMiddleware(req as any, res as any, next);
  }

  @All('trello/*')
  proxyTrello(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyMiddleware(req as any, res as any, next);
  }

  @All('*')
  proxy(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const segments = req.path.split('/').filter(Boolean);
    const service = segments[1];

    // Debug logging
    try {
      appendFileSync(
        '/tmp/gateway-debug.log',
        `Path: ${req.path} | Service: ${service} | Segments: ${JSON.stringify(segments)}\n`,
      );
    } catch {}

    if (!service) {
      return next(new NotFoundException(`API Route not found`));
    }

    // Controllers natively handled by this gateway skip proxy
    if (service === 'health' || service === 'docs' || service === 'users') {
      return next();
    }

    // Route Validation
    switch (service) {
      case 'workflows':
      case 'orchestration':
      case 'workspace':
      case 'agents':
      case 'executions':
      case 'models':
      case 'api-keys':
      case 'tools':
      case 'vectors':
      case 'collections':
      case 'files':
      case 'auth':
      case 'users':
      case 'github':
      case 'trello':
        break;
      default:
        return next(
          new NotFoundException(`API Route /api/${service} not found or no proxy configured.`),
        );
    }

    // Append userId if authenticated
    const user = req.user as any;

    if (user && user.userId) {
      if (!req.url.includes(`userId=`)) {
        const glue = req.url.includes('?') ? '&' : '?';
        req.url = `${req.url}${glue}userId=${user.userId}`;
      }
    } else if (service !== 'auth') {
      this.logger.warn(`No user identity found for protected route: ${req.path}`);
    }

    this.logger.debug(`Proxying request: ${req.method} ${req.url}`);

    return this.proxyMiddleware(req as any, res as any, next);
  }
}
