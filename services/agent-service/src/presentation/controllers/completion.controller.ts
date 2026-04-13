import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompletionDto } from '../../application/dto/completion.dto';
import { CompletionUseCase } from '../../application/use-cases/completion.use-case';

@ApiTags('Completions')
@Controller('completions')
export class CompletionController {
  constructor(private readonly completionUseCase: CompletionUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a one-shot LLM completion with a given model' })
  @ApiResponse({ status: 200, description: 'Completion result' })
  async complete(@Body() dto: CompletionDto): Promise<{ content: string; tokens: number }> {
    return this.completionUseCase.execute(dto);
  }
}
