import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ivm from 'isolated-vm';
import { SandboxExecutor } from '@domain/tool-execution.interface';

@Injectable()
export class SandboxExecutorService implements SandboxExecutor {
  private readonly logger = new Logger(SandboxExecutorService.name);
  private readonly maxMemoryMB: number;
  private readonly sandboxEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.maxMemoryMB = this.configService.get<number>('MAX_TOOL_MEMORY_MB', 128);
    this.sandboxEnabled = this.configService.get<boolean>('SANDBOX_ENABLED', true);
  }

  async execute(code: string, context: Record<string, any>, timeout: number): Promise<any> {
    if (!this.sandboxEnabled) {
      this.logger.warn('Sandbox is disabled - executing code without isolation');
      return this.executeUnsafe(code, context);
    }

    try {
      // Create isolated VM instance
      const isolate = new ivm.Isolate({ memoryLimit: this.maxMemoryMB });
      const ivmContext = await isolate.createContext();

      // Create logging functions
      const jail = ivmContext.global;
      await jail.set('global', jail.derefInto());

      // Create console mock
      const consoleLog = new ivm.Reference((...args: any[]) => {
        this.logger.log('Tool output:', ...args);
      });
      const consoleError = new ivm.Reference((...args: any[]) => {
        this.logger.error('Tool error:', ...args);
      });
      const consoleWarn = new ivm.Reference((...args: any[]) => {
        this.logger.warn('Tool warning:', ...args);
      });

      await jail.set('_consoleLog', consoleLog);
      await jail.set('_consoleError', consoleError);
      await jail.set('_consoleWarn', consoleWarn);

      // Setup console
      await ivmContext.eval(`
        global.console = {
          log: (...args) => _consoleLog.applyIgnored(undefined, args),
          error: (...args) => _consoleError.applyIgnored(undefined, args),
          warn: (...args) => _consoleWarn.applyIgnored(undefined, args)
        };
      `);

      // Set parameters as JSON
      const parametersJson = JSON.stringify(context);
      await jail.set('_parametersJson', parametersJson);
      await ivmContext.eval('const parameters = JSON.parse(_parametersJson);');

      // Wrap code in async function
      const wrappedCode = `
        (async function() {
          ${code}
        })()
      `;

      // Compile and run with timeout
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(ivmContext, { timeout, promise: true });

      // Clean up
      isolate.dispose();

      return result;
    } catch (error) {
      this.logger.error('Sandbox execution error:', error);
      
      if (error.message?.includes('Script execution timed out')) {
        throw new Error(`Execution timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  private executeUnsafe(code: string, context: Record<string, any>): any {
    const func = new Function(...Object.keys(context), code);
    return func(...Object.values(context));
  }
}
