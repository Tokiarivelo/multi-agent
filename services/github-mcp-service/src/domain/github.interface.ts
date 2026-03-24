export interface GithubRepository {
  full_name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  topics: string[];
}

export interface GithubIssue {
  number: number;
  title: string;
  state: string;
  url: string;
  labels: string[];
  created_at: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  head: string;
  base: string;
  created_at: string;
}
