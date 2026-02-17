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
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AddApiKeyUseCase,
  GetApiKeyUseCase,
  ListApiKeysUseCase,
  UpdateApiKeyUseCase,
  DeleteApiKeyUseCase,
} from '../../application/use-cases';
import { CreateApiKeyDto, UpdateApiKeyDto } from '../../application/dto';
import { ModelProvider } from '../../domain/entities/model.entity';

@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly addApiKeyUseCase: AddApiKeyUseCase,
    private readonly getApiKeyUseCase: GetApiKeyUseCase,
    private readonly listApiKeysUseCase: ListApiKeysUseCase,
    private readonly updateApiKeyUseCase: UpdateApiKeyUseCase,
    private readonly deleteApiKeyUseCase: DeleteApiKeyUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createApiKeyDto: CreateApiKeyDto) {
    return this.addApiKeyUseCase.execute(createApiKeyDto);
  }

  @Get()
  async findAll(
    @Query('userId') userId: string,
    @Query('provider') provider?: string,
    @Query('isActive') isActive?: string,
    @Query('isValid') isValid?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }

    const filters: any = {};

    if (provider) {
      filters.provider = provider as ModelProvider;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (isValid !== undefined) {
      filters.isValid = isValid === 'true';
    }

    return this.listApiKeysUseCase.execute(userId, filters);
  }

  @Get('provider/:provider')
  async getByProvider(
    @Param('provider') provider: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }

    return this.listApiKeysUseCase.getByProvider(userId, provider as ModelProvider);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.getApiKeyUseCase.execute(id);
  }

  @Get(':id/decrypt')
  async getDecryptedKey(
    @Param('id') id: string,
    @Headers('x-internal-secret') internalSecret: string,
  ) {
    if (internalSecret !== process.env.INTERNAL_SECRET) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    const decryptedKey = await this.getApiKeyUseCase.getDecryptedKey(id);
    return { key: decryptedKey };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateApiKeyDto: UpdateApiKeyDto) {
    return this.updateApiKeyUseCase.execute(id, updateApiKeyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.deleteApiKeyUseCase.execute(id);
  }
}
