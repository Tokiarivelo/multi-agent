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
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAgentUseCase } from '../../application/use-cases/create-agent.use-case';
import { ListAgentsUseCase } from '../../application/use-cases/list-agents.use-case';
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { CreateAgentDto } from '../../application/dto/create-agent.dto';
import { ExecuteAgentDto } from '../../application/dto/execute-agent.dto';

@Controller('agents')
export class AgentController {
  constructor(
    private readonly createAgentUseCase: CreateAgentUseCase,
    private readonly listAgentsUseCase: ListAgentsUseCase,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: CreateAgentDto, @Query('userId') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }
    return this.createAgentUseCase.execute({ ...createAgentDto, userId });
  }

  @Get()
  async findAll(
    @Query('userId') userId: string,
    @Query('name') name?: string,
    @Query('modelId') modelId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : pageSize ? parseInt(pageSize, 10) : undefined;
    return this.listAgentsUseCase.execute({
      userId,
      name,
      modelId,
      limit: parsedLimit,
      page: page ? parseInt(page, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }
    return this.listAgentsUseCase.getById(id, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAgentDto: Partial<CreateAgentDto>,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }
    return this.listAgentsUseCase.update(id, updateAgentDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('userId is required');
    }
    await this.listAgentsUseCase.delete(id, userId);
  }

  @Post(':id/execute')
  async execute(@Param('id') id: string, @Body() executeAgentDto: ExecuteAgentDto) {
    if (executeAgentDto.stream) {
      return {
        message: 'For streaming execution, use WebSocket connection at /agent-execution',
      };
    }

    return this.executeAgentUseCase.execute(id, executeAgentDto);
  }
}
