# axios-impersonate-adapter

Axios adapter that sends requests through `curl-impersonate`.

## Install

```bash
pnpm add axios-impersonate-adapter
# or
npm i axios-impersonate-adapter
# or
yarn add axios-impersonate-adapter
```

## Quick Start

```ts
import axios from 'axios';
import adapter from 'axios-impersonate-adapter';

const client = axios.create({
  adapter,
  impersonate: 'chrome142',
});

const res = await client.get('https://example.com', {
  params: { q: 'test' },
});

console.log(res.status, res.data);
```

## Configuration

The adapter reads these fields from `AxiosRequestConfig`:

- `impersonate`: browser profile name. If omitted, defaults to `chrome142`.
- `timeout`: max request time (ms). Mapped to `curl --max-time`.
- `maxRedirects`:
  - `undefined` → follow redirects (`--location`)
  - `number` → follow redirects with a limit (`--location --max-redirs <n>`)
- `proxy`:
  - `protocol`: default `http`
  - `host`: hostname or URL
  - `port`: optional port
  - `auth`: `{ username, password? }` → `--proxy-user`
- `headers`: merged with the impersonate defaults.
  - If the request only has axios default `Accept` (`application/json, text/plain, */*`),
    the adapter removes it so the impersonate default `Accept` can apply.
- `jar`: A `tough-cookie` `CookieJar` instance.

## Cookie Support

The adapter supports cookie persistence via [tough-cookie](https://github.com/salesforce/tough-cookie).

```ts
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import adapter from 'axios-impersonate-adapter';

const jar = new CookieJar();
const client = axios.create({
  adapter,
  jar,
});

// Cookies set by this request are stored in `jar`
await client.get('https://example.com/login');

// Cookies from `jar` are sent with this request
await client.get('https://example.com/dashboard');
```

## TypeScript

This package augments `AxiosRequestConfig` with `impersonate`.

```ts
import 'axios-impersonate-adapter';
```

## Notes

- The adapter shells out to the bundled `curl-impersonate` binary.
  https://github.com/lexiforest/curl-impersonate

## Roadmap

- ~~Session support (cookie persistence).~~
- Migrate from spawn-based execution to a native implementation.

## Development

```bash
pnpm build
pnpm lint
pnpm test
```

### Scripts

- `pnpm run generate-impersonates`: regenerates `src/impersonate.ts` from the upstream profiles.
- `pnpm run prepare-submodule`: syncs the `curl-impersonate` submodule to the expected revision.
