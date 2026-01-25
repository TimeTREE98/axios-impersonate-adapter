'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');
fs.mkdirSync(BIN_DIR, { recursive: true });
const binaryName = process.platform === 'win32' ? 'curl-impersonate.exe' : 'curl-impersonate';
const targetPath = path.join(BIN_DIR, binaryName);

// for GitHub actions
const resolveGithubToken = () => {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return token && token.trim() ? token.trim() : null;
};

const buildGithubHeaders = (accept) => {
  const headers = {
    'User-Agent': 'curl-impersonate-installer',
    Accept: accept,
  };
  const token = resolveGithubToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const resolveRelease = async () => {
  const version = process.env.CURL_IMPERSONATE_VERSION;
  const normalized = version && version.trim() ? version.trim() : undefined;

  const tag =
    !normalized || normalized === 'latest' || normalized === 'vlatest' ? 'latest' : normalized.startsWith('v') ? normalized : `v${normalized}`;

  const url =
    tag === 'latest'
      ? 'https://api.github.com/repos/lexiforest/curl-impersonate/releases/latest'
      : `https://api.github.com/repos/lexiforest/curl-impersonate/releases/tags/${tag}`;

  const release = await fetch(url, {
    headers: buildGithubHeaders('application/vnd.github+json'),
  }).then((res) => res.json());

  if (!release || !release.tag_name || !Array.isArray(release.assets)) {
    throw new Error('[curl-impersonate] unexpected release response from GitHub');
  }
  return release;
};

const resolveAssetSuffix = () => {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return 'arm64-macos';
    }
    if (arch === 'x64') {
      return 'x86_64-macos';
    }
  }

  if (platform === 'linux') {
    const libc = process.env.CURL_IMPERSONATE_LIBC === 'musl' ? 'musl' : 'gnu';
    if (arch === 'x64') {
      return `x86_64-linux-${libc}`;
    }
    if (arch === 'arm64') {
      return `aarch64-linux-${libc}`;
    }
    if (arch === 'arm') {
      return 'arm-linux-gnueabihf';
    }
    if (arch === 'ia32') {
      return 'i386-linux-gnu';
    }
    if (arch === 'riscv64') {
      return 'riscv64-linux-gnu';
    }
  }

  throw new Error(`[curl-impersonate] unsupported platform ${platform} (${arch})`);
};

const selectAsset = (release, suffix) => {
  const assetName = `curl-impersonate-${release.tag_name}.${suffix}.tar.gz`;
  const asset = release.assets.find((item) => item && item.name === assetName);
  if (!asset || !asset.browser_download_url) {
    throw new Error(`[curl-impersonate] missing release asset ${assetName}`);
  }
  return asset;
};

// Download the binary from the GitHub releases and copy it to the bin directory
const main = async () => {
  if (fs.existsSync(targetPath)) {
    console.debug(`[curl-impersonate] binary already exists at ${targetPath}`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curl-impersonate-download-'));
  try {
    const release = await resolveRelease();
    const suffix = resolveAssetSuffix();
    const asset = selectAsset(release, suffix);
    const archivePath = path.join(tmpDir, asset.name);

    const buffer = await fetch(asset.browser_download_url).then((res) => res.arrayBuffer());
    fs.writeFileSync(archivePath, Buffer.from(buffer));

    spawnSync('tar', ['-xzf', archivePath, '-C', tmpDir], { stdio: 'inherit' });

    fs.copyFileSync(path.join(tmpDir, 'curl-impersonate'), targetPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
