import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetMarketplaceTemplateUseCase } from '../../application/use-cases/get-marketplace-template.use-case';
import { InstallTemplateUseCase } from '../../application/use-cases/install-template.use-case';
import { ListMarketplaceTemplatesUseCase } from '../../application/use-cases/list-marketplace-templates.use-case';
import {
  PublishWorkflowUseCase,
  PublishWorkflowInput,
  UpdatePublishedInput,
} from '../../application/use-cases/publish-workflow.use-case';
import { GetInstallersUseCase } from '../../application/use-cases/get-installers.use-case';

@ApiTags('Marketplace')
@Controller('workflows/marketplace')
export class MarketplaceController {
  constructor(
    private readonly listTemplatesUseCase: ListMarketplaceTemplatesUseCase,
    private readonly getTemplateUseCase: GetMarketplaceTemplateUseCase,
    private readonly installTemplateUseCase: InstallTemplateUseCase,
    private readonly publishWorkflowUseCase: PublishWorkflowUseCase,
    private readonly getInstallersUseCase: GetInstallersUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List marketplace templates' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listTemplatesUseCase.execute({
      category,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List distinct template categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  async categories() {
    return this.listTemplatesUseCase.getCategories();
  }

  @Get('my-published')
  @ApiOperation({ summary: 'List workflows published by the current user' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Published workflows retrieved' })
  async myPublished(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.getInstallersUseCase.getMyPublished(userId);
  }

  @Get(':id/installers')
  @ApiOperation({ summary: 'List users who installed a template (owner only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Installers retrieved' })
  @ApiResponse({ status: 403, description: 'Not the template owner' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async installers(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.getInstallersUseCase.getInstallers(id, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template detail including nodes and edges' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Template found' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('id') id: string) {
    return this.getTemplateUseCase.execute(id);
  }

  @Post('publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a workflow to the marketplace' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiBody({ schema: { type: 'object', required: ['workflowId', 'description', 'category'] } })
  @ApiResponse({ status: 201, description: 'Workflow published' })
  @ApiResponse({ status: 400, description: 'userId required' })
  @ApiResponse({ status: 403, description: 'Not the workflow owner' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Already published' })
  async publish(
    @Query('userId') userId: string,
    @Body() body: Omit<PublishWorkflowInput, 'userId'>,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.publishWorkflowUseCase.publish({ ...body, userId });
  }

  @Post(':id/install')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install template into user workspace' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 201, description: 'Template installed — returns new workflow' })
  @ApiResponse({ status: 400, description: 'userId required' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async install(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.installTemplateUseCase.execute(id, userId);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unpublish a workflow from the marketplace' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 204, description: 'Workflow unpublished' })
  @ApiResponse({ status: 403, description: 'Not the workflow owner' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Not published' })
  async unpublish(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    await this.publishWorkflowUseCase.unpublish(id, userId);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Update published marketplace listing metadata' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Listing updated' })
  @ApiResponse({ status: 403, description: 'Not the workflow owner' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Not published' })
  async updatePublished(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() body: UpdatePublishedInput,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.publishWorkflowUseCase.updatePublished(id, userId, body);
  }
}
