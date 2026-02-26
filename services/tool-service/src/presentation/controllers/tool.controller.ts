import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateToolDto,
  UpdateToolDto,
  ExecuteToolDto,
  ListToolsDto,
} from '@application/dto';
import {
  CreateToolUseCase,
  UpdateToolUseCase,
  DeleteToolUseCase,
  GetToolUseCase,
  ListToolsUseCase,
  ExecuteToolUseCase,
} from '@application/use-cases';

@Controller('tools')
export class ToolController {
  constructor(
    private readonly createToolUseCase: CreateToolUseCase,
    private readonly updateToolUseCase: UpdateToolUseCase,
    private readonly deleteToolUseCase: DeleteToolUseCase,
    private readonly getToolUseCase: GetToolUseCase,
    private readonly listToolsUseCase: ListToolsUseCase,
    private readonly executeToolUseCase: ExecuteToolUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateToolDto) {
    return this.createToolUseCase.execute(dto);
  }

  @Get()
  async list(@Query() dto: ListToolsDto) {
    return this.listToolsUseCase.execute(dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.getToolUseCase.execute(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateToolDto) {
    return this.updateToolUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteToolUseCase.execute(id);
  }

  @Post('execute')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async execute(@Body() dto: ExecuteToolDto) {
    return this.executeToolUseCase.execute(dto);
  }
}
