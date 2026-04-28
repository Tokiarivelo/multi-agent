import { Injectable, Logger } from '@nestjs/common';
import { Workflow, NodeType } from '../entities/workflow.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

export interface ExecutionContext {
  variables: Record<string, any>;
  executionId: string;
  workflowId: string;
  userId: string;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);

  determineNextNodes(
    workflow: Workflow,
    currentNodeId: string,
    execution: WorkflowExecution,
  ): string[] {
    const outgoingEdges = workflow.definition.edges.filter((edge) => edge.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      return [];
    }

    const nextNodes: string[] = [];
    for (const edge of outgoingEdges) {
      if (edge.condition) {
        if (this.evaluateCondition(edge.condition, execution, currentNodeId)) {
          nextNodes.push(edge.target);
        }
      } else {
        nextNodes.push(edge.target);
      }
    }

    return [...new Set(nextNodes)];
  }

  findStartNode(workflow: Workflow): string | null {
    const startNode = workflow.definition.nodes.find((node) => node.type === NodeType.START);
    return startNode?.id || null;
  }

  isEndNode(workflow: Workflow, nodeId: string): boolean {
    const node = workflow.definition.nodes.find((n) => n.id === nodeId);
    return node?.type === NodeType.END;
  }

  private evaluateCondition(
    condition: string,
    execution: WorkflowExecution,
    sourceNodeId?: string,
  ): boolean {
    try {
      const nodeExecution = sourceNodeId
        ? execution.nodeExecutions.findLast((n) => n.nodeId === sourceNodeId)
        : execution.nodeExecutions[execution.nodeExecutions.length - 1];
      const output = nodeExecution?.output;

      const conditionFunction = new Function('output', `return ${condition}`);
      return conditionFunction(output);
    } catch (error) {
      this.logger.error(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  async transformData(
    data: any,
    transformConfig: Record<string, any>,
    logSink?: string[],
  ): Promise<any> {
    if (!transformConfig) {
      return data;
    }

    // Helper: capture a log line
    const capture = (level: string, args: any[]) => {
      const line = `[${level.toUpperCase()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
      if (logSink) logSink.push(line);
      // Also emit to native Node console so it appears in backend terminal
      if (level === 'error') this.logger.error(line);
      else if (level === 'warn') this.logger.warn(line);
      else this.logger.log(line);
    };

    // Custom console to inject into the JS sandbox
    const sandboxConsole = {
      log: (...args: any[]) => capture('log', args),
      warn: (...args: any[]) => capture('warn', args),
      error: (...args: any[]) => capture('error', args),
      info: (...args: any[]) => capture('info', args),
      debug: (...args: any[]) => capture('debug', args),
    };

    if (
      transformConfig.script ||
      (transformConfig.language === 'javascript' && transformConfig.template)
    ) {
      try {
        const scriptContent = transformConfig.script || transformConfig.template;
        // inject `data`, `$` alias, and `console`
        const transformFunction = new Function('data', '$', 'console', scriptContent);
        return transformFunction(data, data, sandboxConsole);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Transform script execution failed: ${msg}`);
        if (logSink) logSink.push(`[ERROR] ${msg}`);
        // Re-throw so the node is marked FAILED and stops all downstream execution
        throw new Error(`Transform script error: ${msg}`);
      }
    }

    if (transformConfig.language === 'python' && transformConfig.template) {
      return new Promise((resolve, reject) => {
        try {
          const tmpFile = path.join(
            os.tmpdir(),
            `tf_${Date.now()}_${Math.random().toString(36).substring(7)}.py`,
          );
          const dataJson = JSON.stringify(data).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const scriptStr = transformConfig.template
            .split('\n')
            .map((l: string) => '    ' + l)
            .join('\n');

          const pyScript = `
import json, sys

data = json.loads('${dataJson}')

class CaptureConsole:
    def log(self, *args):
        print('[LOG]', *args, file=sys.stderr)
        print('[LOG]', *args)
    def error(self, *args):
        print('[ERROR]', *args, file=sys.stderr)

console = CaptureConsole()

def __main(data):
${scriptStr}

res = __main(data)
if res is not None:
    print(json.dumps(res))
`;

          fs.writeFileSync(tmpFile, pyScript);
          childProcess.exec(`python3 ${tmpFile}`, (error, stdout, stderr) => {
            try {
              fs.unlinkSync(tmpFile);
            } catch (e) {}

            // Capture stderr lines into logSink
            if (logSink && stderr) {
              stderr
                .split('\n')
                .filter(Boolean)
                .forEach((l) => logSink!.push(l));
            }

            if (error) {
              const msg = `Python execution failed: ${stderr || error.message}`;
              this.logger.error(msg);
              if (logSink) logSink.push(`[ERROR] ${msg}`);
              // Reject so the error propagates and stops downstream nodes
              return reject(new Error(msg));
            }
            try {
              resolve(JSON.parse(stdout));
            } catch (e) {
              resolve(stdout.trim());
            }
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to execute python script: ${msg}`);
          reject(new Error(`Python script error: ${msg}`));
        }
      });
    }

    if (transformConfig.template) {
      try {
        const templateStr =
          typeof transformConfig.template === 'string'
            ? transformConfig.template
            : JSON.stringify(transformConfig.template);

        // Resolve {{variables}} from input data
        const resolvedTemplate = templateStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
          const value = path
            .trim()
            .split('.')
            .reduce((acc: any, key: string) => acc?.[key], data);

          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return value !== undefined ? String(value) : match;
        });

        try {
          if (transformConfig.language === 'yaml') {
            return yaml.load(resolvedTemplate);
          }
          // Default to JSON if not YAML (or if JSON language explicitly set)
          return JSON.parse(resolvedTemplate);
        } catch {
          // Otherwise emit the raw resolved string
          return resolvedTemplate;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process transform template: ${msg}`);
        throw new Error(`Transform template error: ${msg}`);
      }
    }

    return data;
  }

  buildNodeInput(node: any, execution: WorkflowExecution, context: ExecutionContext): any {
    if (node.config?.inputMapping) {
      return this.applyInputMapping(node.config.inputMapping, execution, context);
    }

    // Use full context variables for the branch instead of race-prone previous execution
    return context.variables;
  }

  private applyInputMapping(
    mapping: Record<string, string>,
    execution: WorkflowExecution,
    context: ExecutionContext,
  ): any {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (value.startsWith('$')) {
        const path = value.substring(1);
        result[key] = this.getValueByPath(path, execution, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getValueByPath(
    path: string,
    execution: WorkflowExecution,
    context: ExecutionContext,
  ): any {
    if (path.startsWith('output.')) {
      const nodeId = path.split('.')[1];
      const nodeExecution = execution.getNodeExecution(nodeId);
      return nodeExecution?.output;
    }

    if (path.startsWith('variables.')) {
      const varName = path.substring('variables.'.length);
      return context.variables[varName];
    }

    return undefined;
  }

  shouldRetry(node: any, nodeExecution: any, maxRetries: number = 3): boolean {
    if (!node.config?.retry) {
      return false;
    }

    return nodeExecution.retryCount < maxRetries;
  }
}
