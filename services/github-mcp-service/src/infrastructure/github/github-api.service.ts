import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { GithubAuthService } from './github-auth.service';
import { GithubRepository, GithubIssue, GithubPullRequest } from '../../domain/github.interface';

@Injectable()
export class GithubApiService {
  constructor(private readonly auth: GithubAuthService) {}

  private async octokit(): Promise<Octokit> {
    const token = await this.auth.getInstallationToken();
    return new Octokit({ auth: token });
  }

  async searchRepositories(query: string, perPage = 10): Promise<GithubRepository[]> {
    const gh = await this.octokit();
    const { data } = await gh.search.repos({ q: query, per_page: perPage });
    return data.items.map((r) => ({
      full_name: r.full_name,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
      topics: r.topics ?? [],
    }));
  }

  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ): Promise<string | Array<{ name: string; path: string; type: string }>> {
    const gh = await this.octokit();
    const { data } = await gh.repos.getContent({
      owner,
      repo,
      path,
      ...(branch ? { ref: branch } : {}),
    });

    if (Array.isArray(data)) {
      return data.map((entry) => ({ name: entry.name, path: entry.path, type: entry.type }));
    }

    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf8');
    }

    throw new Error('Unexpected content type from GitHub');
  }

  async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<{ sha: string; url: string }> {
    const gh = await this.octokit();

    const { data: ref } = await gh.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const baseSha = ref.object.sha;

    const { data: baseCommit } = await gh.git.getCommit({ owner, repo, commit_sha: baseSha });

    const blobs = await Promise.all(
      files.map(async (f) => {
        const { data } = await gh.git.createBlob({
          owner,
          repo,
          content: Buffer.from(f.content).toString('base64'),
          encoding: 'base64',
        });
        return { path: f.path, sha: data.sha, mode: '100644' as const, type: 'blob' as const };
      }),
    );

    const { data: tree } = await gh.git.createTree({
      owner,
      repo,
      tree: blobs,
      base_tree: baseCommit.tree.sha,
    });

    const { data: commit } = await gh.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [baseSha],
    });

    await gh.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });

    return { sha: commit.sha, url: commit.html_url };
  }

  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch = 'main',
  ): Promise<{ branch: string; sha: string }> {
    const gh = await this.octokit();
    const { data: ref } = await gh.git.getRef({ owner, repo, ref: `heads/${fromBranch}` });
    await gh.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: ref.object.sha });
    return { branch, sha: ref.object.sha };
  }

  async listIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    labels?: string,
  ): Promise<GithubIssue[]> {
    const gh = await this.octokit();
    const { data } = await gh.issues.listForRepo({
      owner,
      repo,
      state,
      ...(labels ? { labels } : {}),
      per_page: 30,
    });
    return data.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      url: i.html_url,
      labels: i.labels
        .map((l) => (typeof l === 'string' ? l : l.name))
        .filter((l): l is string => typeof l === 'string'),
      created_at: i.created_at,
    }));
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
  ): Promise<{ number: number; url: string }> {
    const gh = await this.octokit();
    const { data } = await gh.issues.create({
      owner,
      repo,
      title,
      ...(body ? { body } : {}),
      ...(labels ? { labels } : {}),
    });
    return { number: data.number, url: data.html_url };
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    base?: string,
  ): Promise<GithubPullRequest[]> {
    const gh = await this.octokit();
    const { data } = await gh.pulls.list({
      owner,
      repo,
      state,
      ...(base ? { base } : {}),
      per_page: 30,
    });
    return data.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      url: p.html_url,
      head: p.head.ref,
      base: p.base.ref,
      created_at: p.created_at,
    }));
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<{ number: number; url: string }> {
    const gh = await this.octokit();
    const { data } = await gh.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return { number: data.number, url: data.html_url };
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash',
  ): Promise<{ merged: boolean; sha: string }> {
    const gh = await this.octokit();
    const { data } = await gh.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: mergeMethod,
    });
    return { merged: data.merged, sha: data.sha };
  }

  async forkRepository(
    owner: string,
    repo: string,
    organization?: string,
  ): Promise<{ full_name: string; url: string }> {
    const gh = await this.octokit();
    const { data } = await gh.repos.createFork({
      owner,
      repo,
      ...(organization ? { organization } : {}),
    });
    return { full_name: data.full_name, url: data.html_url };
  }
}
