import { dialog } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import type { Repository } from '../../shared/types'

const run = promisify(execFile)

const configDir = join(homedir(), '.pr-reviewer')
const registryPath = join(configDir, 'repositories.json')

async function readRegistry(): Promise<Repository[]> {
  try {
    return JSON.parse(await readFile(registryPath, 'utf8')) as Repository[]
  } catch {
    return []
  }
}

async function writeRegistry(repositories: Repository[]): Promise<void> {
  await mkdir(configDir, { recursive: true })
  await writeFile(registryPath, JSON.stringify(repositories, null, 2))
}

export function listRepositories(): Promise<Repository[]> {
  return readRegistry()
}

function slugFromRemoteUrl(remoteUrl: string): string | null {
  const match = remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
  return match ? match[1] : null
}

async function detectSlug(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['-C', repoPath, 'remote', 'get-url', 'origin'])
    return slugFromRemoteUrl(stdout.trim())
  } catch {
    return null
  }
}

export async function addRepository(): Promise<Repository | null> {
  const result = await dialog.showOpenDialog({
    title: 'Add repository',
    message: 'Choose a local git repository',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const path = result.filePaths[0]
  if (!existsSync(join(path, '.git'))) {
    throw new Error(`"${basename(path)}" is not a git repository. Choose a folder with a .git directory.`)
  }

  const repository: Repository = {
    path,
    name: basename(path),
    slug: await detectSlug(path)
  }

  const repositories = await readRegistry()
  await writeRegistry([repository, ...repositories.filter((known) => known.path !== path)])
  return repository
}

export async function removeRepository(path: string): Promise<Repository[]> {
  const repositories = (await readRegistry()).filter((known) => known.path !== path)
  await writeRegistry(repositories)
  return repositories
}
