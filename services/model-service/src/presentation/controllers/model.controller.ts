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
import {
  CreateModelUseCase,
  GetModelUseCase,
  ListModelsUseCase,
  UpdateModelUseCase,
  DeleteModelUseCase,
} from '../../application/use-cases';
import { CreateModelDto, UpdateModelDto } from '../../application/dto';
import { ModelProvider } from '../../domain/entities/model.entity';

@Controller('models')
export class ModelController {
  constructor(
    private readonly createModelUseCase: CreateModelUseCase,
    private readonly getModelUseCase: GetModelUseCase,
    private readonly listModelsUseCase: ListModelsUseCase,
    private readonly updateModelUseCase: UpdateModelUseCase,
    private readonly deleteModelUseCase: DeleteModelUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createModelDto: CreateModelDto) {
    return this.createModelUseCase.execute(createModelDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
    @Query('provider') provider?: string,
    @Query('isActive') isActive?: string,
    @Query('supportsStreaming') supportsStreaming?: string,
  ) {
    const filters: any = {};

    if (page) filters.page = parseInt(page, 10);
    if (pageSize) filters.limit = parseInt(pageSize, 10);
    if (limit) filters.limit = parseInt(limit, 10);
    if (provider) {
      filters.provider = provider as ModelProvider;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (supportsStreaming !== undefined) {
      filters.supportsStreaming = supportsStreaming === 'true';
    }

    return this.listModelsUseCase.execute(filters);
  }

  @Get('default')
  async getDefault() {
    return this.getModelUseCase.getDefault();
  }

  @Get('provider/:provider')
  async getByProvider(@Param('provider') provider: string) {
    return this.listModelsUseCase.getByProvider(provider as ModelProvider);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.getModelUseCase.execute(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateModelDto: UpdateModelDto) {
    return this.updateModelUseCase.execute(id, updateModelDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.deleteModelUseCase.execute(id);
  }
}
