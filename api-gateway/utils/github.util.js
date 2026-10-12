const GITHUB_REPO_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;
const BRANCH_RE = /^[A-Za-z0-9_./-]{1,100}$/;

/**
 * Validates a public GitHub repository URL and branch.
 * Returns { owner, repo, repoUrl, branch } or { error } with a user-facing message.
 */
function parseGithubImport(repoUrl, branch) {
  const match = GITHUB_REPO_RE.exec(String(repoUrl || '').trim());
  if (!match) {
    return { error: 'Repository URL must look like https://github.com/owner/repo' };
  }
  const targetBranch = String(branch || 'main').trim();
  if (!BRANCH_RE.test(targetBranch) || targetBranch.includes('..')) {
    return { error: 'Branch name contains unsupported characters' };
  }
  const [, owner, repo] = match;
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}`, branch: targetBranch };
}

module.exports = { parseGithubImport };
