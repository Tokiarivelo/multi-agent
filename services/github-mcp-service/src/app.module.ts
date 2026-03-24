import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { GithubAuthService } from '@infrastructure/github/github-auth.service';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import {
  SearchRepositoriesTool,
  GetFileContentsTool,
  PushFilesTool,
  CreateBranchTool,
  ListIssuesTool,
  CreateIssueTool,
  ListPullRequestsTool,
  CreatePullRequestTool,
  MergePullRequestTool,
  ForkRepositoryTool,
} from '@presentation/tools';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
  ],
  controllers: [McpController],
  providers: [
    GithubAuthService,
    GithubApiService,
    SearchRepositoriesTool,
    GetFileContentsTool,
    PushFilesTool,
    CreateBranchTool,
    ListIssuesTool,
    CreateIssueTool,
    ListPullRequestsTool,
    CreatePullRequestTool,
    MergePullRequestTool,
    ForkRepositoryTool,
  ],
})
export class AppModule {}
