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
        }
        return target;
      },
      on: {
        proxyReq: fixRequestBody,
      },
    });
  }

  @All('*')
  proxy(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const segments = req.path.split('/').filter(Boolean);
    const service = segments[1];

    if (!service) {
      return next(new NotFoundException(`API Route not found`));
    }

    // Controllers natively handled by this gateway skip proxy
    if (service === 'auth' || service === 'health' || service === 'docs') {
      return next();
    }

    // Route Validation
    switch (service) {
      case 'workflows':
      case 'orchestration':
      case 'agents':
      case 'executions':
      case 'models':
      case 'api-keys':
      case 'tools':
      case 'vectors':
      case 'collections':
      case 'files':
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
    }

    this.logger.debug(`Proxying request: ${req.method} ${req.url}`);

    return this.proxyMiddleware(req as any, res as any, next);
  }
}
