import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ivm from 'isolated-vm';
import { SandboxExecutor } from '@domain/tool-execution.interface';

@Injectable()
export class SandboxExecutorService implements SandboxExecutor {
  private readonly logger = new Logger(SandboxExecutorService.name);
  private readonly maxMemoryMB: number;
  private readonly sandboxEnabled: boolean;

  private static readonly ALLOWED_MODULES: Record<string, string[]> = {
    child_process: ['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync'],
  };

  constructor(private readonly configService: ConfigService) {
    this.maxMemoryMB = this.configService.get<number>('MAX_TOOL_MEMORY_MB', 128);
    this.sandboxEnabled = this.configService.get<boolean>('SANDBOX_ENABLED', true);
  }

  async execute(
    code: string,
    context: Record<string, unknown>,
    timeout: number,
    cwd?: string,
  ): Promise<unknown> {
    console.log('this.sandboxEnabled :>> ', this.sandboxEnabled);

    if (!this.sandboxEnabled) {
      this.logger.warn('Sandbox is disabled - executing code without isolation');
      return this.executeUnsafe(code, context);
    }

    let isolate: ivm.Isolate | null = null;
    let ivmContext: ivm.Context | null = null;

    try {
      // Create isolated VM instance
      isolate = new ivm.Isolate({ memoryLimit: this.maxMemoryMB });
      ivmContext = await isolate.createContext();

      const jail = ivmContext.global;
      await jail.set('global', jail.derefInto());

      // Create logging functions
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
      await jail.set('_cwdPath', cwd ?? '/');

      // Setup console, __sandboxModules and custom require
      await ivmContext.eval(`
        global.console = {
          log: (...args) => _consoleLog.applyIgnored(undefined, args),
          error: (...args) => _consoleError.applyIgnored(undefined, args),
          warn: (...args) => _consoleWarn.applyIgnored(undefined, args)
        };

        global.__sandboxModules = {};

        // Custom require implementation
        global.require = (name) => {
          if (typeof global.__sandboxModules[name] !== 'undefined') {
            return global.__sandboxModules[name];
          }
          throw new Error("Cannot find module '" + name + "' or module is not allowed in the sandbox.");
        };

        // process shim — cwd resolved from host via _cwdPath
        global.process = {
          cwd: () => _cwdPath,
          env: {},
          platform: "linux",
          versions: { node: "v20.0.0" }
        };
      `);

      // Inject whitelisted modules
      await this.injectModules(ivmContext);

      // Debug: log injected modules
      await ivmContext.eval(`
        console.log('[Sandbox] Injected modules:', Object.keys(global.__sandboxModules));
        if (global.__sandboxModules.child_process) {
          console.log('[Sandbox] child_process methods:', Object.keys(global.__sandboxModules.child_process));
        }
      `);

      // Set parameters as JSON and create params alias
      const parametersJson = JSON.stringify(context);
      await jail.set('_parametersJson', parametersJson);
      await ivmContext.eval(`
        global.parameters = JSON.parse(_parametersJson);
        global.params = global.parameters;
      `);

      // Wrap code in async function
      const wrappedCode = `
        (async function() {
          ${code}
        })()
      `;

      // Compile and run with timeout
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(ivmContext, { timeout, promise: true, copy: true });

      return result;
    } catch (error) {
      this.logger.error('Sandbox execution error:');
      this.logger.error(error);

      if (error.message?.includes('Script execution timed out')) {
        throw new Error(`Execution timeout after ${timeout}ms`);
      }

      throw error;
    } finally {
      // Clean up
      if (ivmContext) {
        try {
          ivmContext.global.deleteSync('_consoleLog');
          ivmContext.global.deleteSync('_consoleError');
          ivmContext.global.deleteSync('_consoleWarn');
          ivmContext.global.deleteSync('_parametersJson');
          ivmContext.global.deleteSync('_cwdPath');
        } catch (e) {
          // ignore cleanup errors
        }
      }
      if (isolate) {
        isolate.dispose();
      }
    }
  }

  private async injectModules(ivmContext: ivm.Context): Promise<void> {
    this.logger.log('Injecting modules into sandbox...');

    for (const [moduleName, methods] of Object.entries(SandboxExecutorService.ALLOWED_MODULES)) {
      this.logger.log(`Injecting module: ${moduleName}`);

      try {
        // Initialize module object in sandbox
        await ivmContext.eval(`global.__sandboxModules['${moduleName}'] = {};`);

        // Load module in HOST context (not sandbox)
        const actualModuleImport = await import(moduleName);
        const actualModule = actualModuleImport.default ?? actualModuleImport;

        for (const method of methods) {
          const fn = (actualModule as Record<string, any>)[method];

          if (typeof fn !== 'function') {
            this.logger.debug(`Method ${moduleName}.${method} is not a function, skipping`);
            continue;
          }

          // Only inject sync methods (execSync, spawnSync, etc.) to avoid transfer issues
          if (method.includes('Sync')) {
            try {
              // Create a wrapper function that executes in host
              const hostFunc = (argsJson: string): string => {
                try {
                  const parsed = JSON.parse(argsJson);
                  const args = Array.isArray(parsed) ? parsed : [parsed];

                  const result = fn(...args);

                  return JSON.stringify(result, (_key, val) =>
                    Buffer.isBuffer(val) ? val.toString() : val,
                  );
                } catch (error: unknown) {
                  return JSON.stringify({
                    error: (error as Error).message,
                  });
                }
              };

              const ref = new ivm.Reference(hostFunc);

              await ivmContext.evalClosure(
                `
              global.__sandboxModules['${moduleName}']['${method}'] = (...args) => {
                const resJson = $0.applySync(undefined, [JSON.stringify(args)], { result: { copy: true } });
                return resJson ? JSON.parse(resJson) : undefined;
              };
            `,
                [ref],
              );

              this.logger.debug(`Injected ${moduleName}.${method} into sandbox`);
            } catch (err: any) {
              this.logger.warn(`Failed to inject ${moduleName}.${method}: ${err.message}`);
            }
          } else {
            this.logger.debug(
              `Skipping async method ${moduleName}.${method} - use sync version instead`,
            );
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to inject module ${moduleName}: ${err.message}`);
      }
    }
  }

  private executeUnsafe(code: string, context: Record<string, any>): any {
    const func = new Function(...Object.keys(context), code);
    return func(...Object.values(context));
  }
}
