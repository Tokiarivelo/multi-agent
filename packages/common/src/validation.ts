import { validate, ValidationError as ClassValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class ValidationService {
  static async validateDto<T extends object>(
    dtoClass: new () => T,
    plain: object,
  ): Promise<{ valid: boolean; errors?: string[]; data?: T }> {
    const dtoInstance = plainToClass(dtoClass, plain);
    const errors = await validate(dtoInstance);

    if (errors.length > 0) {
      return {
        valid: false,
        errors: this.formatErrors(errors),
      };
    }

    return {
      valid: true,
      data: dtoInstance,
    };
  }

  private static formatErrors(errors: ClassValidationError[]): string[] {
    return errors.flatMap((error) => Object.values(error.constraints || {}));
  }
}
