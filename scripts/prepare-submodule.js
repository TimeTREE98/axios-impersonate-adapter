'use strict';

const { spawnSync } = require('node:child_process');

// step 1: update submodule
const updateResult = spawnSync('git', ['submodule', 'update', '--init', '--recursive'], {
  stdio: 'inherit',
});

if (updateResult.error || updateResult.status !== 0) {
  console.warn('[submodule] update failed; continue without it.');
  process.exit(0);
}

// step 2: get tags
const tagsResult = spawnSync('git', ['-C', 'curl-impersonate', 'tag', '--list', '--sort=-v:refname'], {
  encoding: 'utf8',
});

const tags = (tagsResult.stdout || '').trim();
if (tagsResult.error || tagsResult.status !== 0 || !tags) {
  console.warn('[curl-impersonate] no tags found.');
  process.exit(0);
}

// step 3: checkout latest tag
const latestTag = tags.split('\n')[0].trim();
const checkoutResult = spawnSync('git', ['-C', 'curl-impersonate', 'checkout', '--quiet', latestTag], {
  stdio: 'inherit',
});

if (checkoutResult.error || checkoutResult.status !== 0) {
  console.warn('[curl-impersonate] failed to checkout latest tag.');
}
