#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runGit(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    return '';
  }
}

// 1. Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');
const forceBump = args.find(a => a.startsWith('--bump='))?.split('=')[1] || null;

console.log('=== Scoped Commits Semantic Release ===');
if (dryRun) console.log('[DRY RUN MODE - No files will be modified]\n');

// 2. Get latest tag
let latestTag = runGit('git describe --tags --abbrev=0 --match="v*"');
let commitRange = '';

if (latestTag) {
  console.log(`Latest release tag: ${latestTag}`);
  commitRange = `${latestTag}..HEAD`;
} else {
  console.log('No previous release tags found. Analyzing all commits.');
  commitRange = 'HEAD';
}

// 3. Get commits since latest tag
// Format output as: Hash|Message
const logOutput = runGit(`git log --reverse --format="%H|%s" ${commitRange}`);
const commits = [];

if (logOutput) {
  logOutput.split('\n').forEach(line => {
    if (line.includes('|')) {
      const [hash, msg] = line.split('|', 2);
      commits.push({ hash, msg });
    }
  });
}

if (commits.length === 0) {
  console.log('No new commits found. Nothing to release.');
  process.exit(0);
}

console.log(`Found ${commits.length} new commits since last release.`);

// Heuristics lists
const featureVerbs = ['add', 'implement', 'support', 'new', 'feat', 'create', 'introduce'];
const fixVerbs = [
  'fix', 'resolve', 'correct', 'bug', 'prevent', 'avoid', 'handle',
  'style', 'refactor', 'clean', 'tidy', 'remove', 'revert', 'docs',
  'update', 'format', 'change', 'adjust', 'tweak', 'fine-tune', 'align', 'improve', 'convert'
];

let bumpType = 'patch'; // Default to patch
const scopesMap = {};

for (const commit of commits) {
  const { msg } = commit;
  
  // Parse Scoped Commit format: <scope>: <description>
  const match = msg.match(/^([^:\s]+)(!?):\s*(.*)$/);
  if (!match) {
    // Non-conforming commit, treat as patch
    if (!scopesMap['misc']) scopesMap['misc'] = [];
    scopesMap['misc'].push(msg);
    continue;
  }

  const [_, scope, isBreakingSymbol, desc] = match;
  const scopeClean = scope.toLowerCase();
  
  if (!scopesMap[scopeClean]) scopesMap[scopeClean] = [];
  scopesMap[scopeClean].push(desc);

  // Check for breaking changes
  const isBreaking = isBreakingSymbol === '!' || msg.includes('BREAKING CHANGE:') || msg.includes('breaking change:');
  if (isBreaking) {
    bumpType = 'major';
    continue;
  }

  if (bumpType !== 'major') {
    const firstWord = desc.split(' ')[0].toLowerCase();
    if (featureVerbs.includes(firstWord)) {
      bumpType = 'minor';
    } else if (fixVerbs.includes(firstWord)) {
      // already 'patch', keep it
    }
  }
}

// Apply forced bump type override
if (forceBump) {
  if (['major', 'minor', 'patch'].includes(forceBump.toLowerCase())) {
    bumpType = forceBump.toLowerCase();
    console.log(`Forcing version bump type: ${bumpType} (manual override)`);
  } else {
    console.warn(`Warning: Invalid forced bump type "${forceBump}". Using calculated bump instead.`);
  }
} else {
  console.log(`Calculated version bump type: ${bumpType}`);
}

// 4. Read current package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: package.json not found in current directory.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version || '0.0.0';
console.log(`Current project version: v${currentVersion}`);

// 5. Calculate new version
const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Error: Current version "${currentVersion}" is not valid SemVer.`);
  process.exit(1);
}

let [major, minor, patch] = parts;
if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
const nextTag = `v${nextVersion}`;
console.log(`Next release version: ${nextTag}`);

// 6. Generate Changelog Entry
const today = new Date().toISOString().split('T')[0];
let changelogEntry = `## ${nextTag} (${today})\n\n`;

Object.keys(scopesMap).sort().forEach(scope => {
  changelogEntry += `### ${scope}\n`;
  scopesMap[scope].forEach(desc => {
    changelogEntry += `- ${desc}\n`;
  });
  changelogEntry += '\n';
});

if (dryRun) {
  console.log('\n--- Generated Changelog Entry ---');
  console.log(changelogEntry.trim());
  console.log('---------------------------------\n');
  process.exit(0);
}

// 7. Write version back to package.json
packageJson.version = nextVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`Updated package.json version to ${nextVersion}`);

// 8. Update CHANGELOG.md
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
let currentChangelog = '';
if (fs.existsSync(changelogPath)) {
  currentChangelog = fs.readFileSync(changelogPath, 'utf8');
}

const newChangelog = changelogEntry + currentChangelog;
fs.writeFileSync(changelogPath, newChangelog, 'utf8');
console.log('Updated CHANGELOG.md');

// 9. Git commit & tag
try {
  execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
  execSync(`git commit -m "release: ${nextTag}"`, { stdio: 'inherit' });
  execSync(`git tag -a ${nextTag} -m "Release ${nextTag}"`, { stdio: 'inherit' });
  console.log(`Successfully created git commit and tag ${nextTag}!`);
  console.log('\nRun `git push --follow-tags` to publish this release.');
} catch (err) {
  console.error('Git execution failed during release commit/tag:', err.message);
  process.exit(1);
}
