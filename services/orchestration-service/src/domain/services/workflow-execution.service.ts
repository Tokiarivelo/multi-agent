import { Injectable, Logger } from '@nestjs/common';
import { Workflow, NodeType } from '../entities/workflow.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';

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
        if (this.evaluateCondition(edge.condition, execution)) {
          nextNodes.push(edge.target);
        }
      } else {
        nextNodes.push(edge.target);
      }
    }

    return nextNodes;
  }

  findStartNode(workflow: Workflow): string | null {
    const startNode = workflow.definition.nodes.find((node) => node.type === NodeType.START);
    return startNode?.id || null;
  }

  isEndNode(workflow: Workflow, nodeId: string): boolean {
    const node = workflow.definition.nodes.find((n) => n.id === nodeId);
    return node?.type === NodeType.END;
  }

  private evaluateCondition(condition: string, execution: WorkflowExecution): boolean {
    try {
      const lastNodeExecution = execution.nodeExecutions[execution.nodeExecutions.length - 1];
      const output = lastNodeExecution?.output;

      const conditionFunction = new Function('output', `return ${condition}`);
      return conditionFunction(output);
    } catch (error) {
      this.logger.error(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  transformData(data: any, transformConfig: Record<string, any>): any {
    if (!transformConfig || !transformConfig.script) {
      return data;
    }

    try {
      const transformFunction = new Function('data', transformConfig.script);
      return transformFunction(data);
    } catch (error) {
      this.logger.error(`Failed to transform data`, error);
      return data;
    }
  }

  buildNodeInput(node: any, execution: WorkflowExecution, context: ExecutionContext): any {
    if (node.config?.inputMapping) {
      return this.applyInputMapping(node.config.inputMapping, execution, context);
    }

    const previousNodeExecution = execution.nodeExecutions[execution.nodeExecutions.length - 1];
    return previousNodeExecution?.output || context.variables;
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
