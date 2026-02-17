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
  async create(@Body() createAgentDto: CreateAgentDto) {
    return this.createAgentUseCase.execute(createAgentDto);
  }

  @Get()
  async findAll(
    @Query('name') name?: string,
    @Query('modelId') modelId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listAgentsUseCase.execute({
      name,
      modelId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.listAgentsUseCase.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAgentDto: Partial<CreateAgentDto>,
  ) {
    return this.listAgentsUseCase.update(id, updateAgentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.listAgentsUseCase.delete(id);
  }

  @Post(':id/execute')
  async execute(
    @Param('id') id: string,
    @Body() executeAgentDto: ExecuteAgentDto,
  ) {
    if (executeAgentDto.stream) {
      return {
        message: 'For streaming execution, use WebSocket connection at /agent-execution',
      };
    }
    
    return this.executeAgentUseCase.execute(id, executeAgentDto);
  }
}
