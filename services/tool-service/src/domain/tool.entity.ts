export enum ToolCategory {
  WEB = 'WEB',
  API = 'API',
  DATABASE = 'DATABASE',
  FILE = 'FILE',
  CUSTOM = 'CUSTOM',
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  code?: string;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ToolEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly category: ToolCategory,
    public readonly parameters: ToolParameter[],
    public readonly code: string | null,
    public readonly isBuiltIn: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(data: any): ToolEntity {
    return new ToolEntity(
      data.id,
      data.name,
      data.description,
      data.category,
      data.parameters,
      data.code,
      data.isBuiltIn,
      data.createdAt,
      data.updatedAt,
    );
  }

  toPrisma() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: this.parameters,
      code: this.code,
      isBuiltIn: this.isBuiltIn,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  validateParameters(params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (param.name in params) {
        const value = params[param.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (param.type === 'object' && actualType !== 'object') {
          errors.push(`Parameter ${param.name} must be an object`);
        } else if (param.type !== 'object' && param.type !== actualType) {
          errors.push(`Parameter ${param.name} must be of type ${param.type}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
