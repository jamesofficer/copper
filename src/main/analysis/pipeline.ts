import type { AnalysisResult } from '../../shared/types'

// TODO: real pipeline — sync repo, parse diff, then agent passes for
// grouping, summary lenses, and blast radius, streamed to the renderer
export async function analyzePullRequest(repo: string, prNumber: number): Promise<AnalysisResult> {
  return {
    repo,
    prNumber,
    headSha: 'mock',
    files: [
      { path: 'src/api/campaigns.ts', status: 'modified', additions: 120, deletions: 10, mechanical: false },
      { path: 'src/db/schema.ts', status: 'modified', additions: 24, deletions: 2, mechanical: false },
      { path: 'pnpm-lock.yaml', status: 'modified', additions: 368, deletions: 76, mechanical: true }
    ],
    groups: [
      {
        id: 'scheduling',
        title: 'Campaign scheduling core',
        why: 'Adds the schedule column and the API endpoint that writes it.',
        files: ['src/db/schema.ts', 'src/api/campaigns.ts'],
        risk: 'high',
        mechanical: false
      },
      {
        id: 'deps',
        title: 'Dependency updates',
        why: 'Lockfile churn from adding the cron parsing library.',
        files: ['pnpm-lock.yaml'],
        risk: 'low',
        mechanical: true
      }
    ],
    readingOrder: ['scheduling', 'deps'],
    summaries: {
      overview: 'Mock analysis — the real pipeline is not wired up yet.',
      risks: 'None: this is placeholder data.',
      behavior: 'No behavior changes; placeholder.',
      scope: 'Placeholder.'
    }
  }
}
