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
import { GetTokenUsageUseCase } from '../../application/use-cases/get-token-usage.use-case';
import { CreateAgentDto } from '../../application/dto/create-agent.dto';
import { ExecuteAgentDto } from '../../application/dto/execute-agent.dto';

@Controller('agents')
export class AgentController {
  constructor(
    private readonly createAgentUseCase: CreateAgentUseCase,
    private readonly listAgentsUseCase: ListAgentsUseCase,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly getTokenUsageUseCase: GetTokenUsageUseCase,
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

  @Get('token-usage')
  async getTokenUsage(
    @Query('userId') userId: string,
    @Query('agentId') agentId?: string,
    @Query('model') model?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new UnauthorizedException('userId is required');
    return this.getTokenUsageUseCase.execute({
      userId,
      agentId,
      model,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('token-usage/chart')
  async getTokenUsageChart(
    @Query('userId') userId: string,
    @Query('period') period: string,
    @Query('agentId') agentId?: string,
    @Query('isTest') isTest?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    if (!userId) throw new UnauthorizedException('userId is required');
    return this.getTokenUsageUseCase.getChart({
      userId,
      period: (period === 'weekly' || period === 'monthly' ? period : 'daily') as any,
      agentId,
      isTest: isTest === 'true' ? true : isTest === 'false' ? false : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get(':agentId/token-usage')
  async getAgentTokenUsage(
    @Param('agentId') agentId: string,
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!userId) throw new UnauthorizedException('userId is required');
    return this.getTokenUsageUseCase.execute({
      userId,
      agentId,
      fromDate: startDate ? new Date(startDate) : undefined,
      toDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
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
