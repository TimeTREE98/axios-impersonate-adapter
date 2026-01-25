import '../src/types';

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough, type Readable, type Writable } from 'node:stream';

import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { adapter } from '../src/adapter';
import { DEFAULTS } from '../src/impersonate';

const spawn = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawn(...args),
}));

type MockChild = ChildProcess & {
  stdout: Readable;
  stderr: Readable;
  stdin: Writable & { end: jest.Mock };
};

const createMockChild = (): MockChild => {
  const child = new EventEmitter() as MockChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const stdin = new PassThrough() as unknown as Writable & { end: jest.Mock };
  stdin.end = jest.fn();
  child.stdin = stdin;
  return child;
};

const emitResponse = (child: MockChild, rawHeaders: string, body: string, code = 0): void => {
  const payload = Buffer.concat([Buffer.from(rawHeaders, 'utf8'), Buffer.from(body, 'utf8')]);
  child.stdout.emit('data', payload);
  child.emit('close', code);
};

const baseConfig = (): InternalAxiosRequestConfig => ({
  method: 'get',
  headers: new AxiosHeaders(),
  baseURL: 'https://example.com',
  url: '/resource',
  timeout: 0,
  maxRedirects: 0,
  validateStatus: () => true,
});

describe('adapter', () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  it('uses impersonate default Accept when axios default Accept is present', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.impersonate = 'safari184';

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\ncontent-type: text/plain\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    const argsLower = args.map((value) => String(value).toLowerCase());
    expect(argsLower).toContain('-h');
    expect(argsLower).toContain(`accept: ${DEFAULTS.safari184.headers.accept ?? DEFAULTS.safari184.headers.Accept}`.toLowerCase());
  });

  it('respects a custom Accept header override', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.impersonate = 'safari184';
    config.headers.set('Accept', 'application/json');

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    const argsLower = args.map((value) => String(value).toLowerCase());
    expect(argsLower).toContain('accept: application/json');
  });

  it('builds URL with baseURL, url, and params', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.params = { q: 'test', page: 2 };

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    expect(args).toContain('https://example.com/resource?q=test&page=2');
  });

  it('adds proxy flags when proxy config is provided', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.proxy = {
      protocol: 'http',
      host: 'proxy.local',
      port: 8080,
      auth: { username: 'user', password: 'pass' },
    };

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    expect(args).toContain('--proxy');
    expect(args).toContain('http://proxy.local:8080');
    expect(args).toContain('--proxy-user');
    expect(args).toContain('user:pass');
  });

  it('adds redirect flags based on maxRedirects', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.maxRedirects = undefined;

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    let [, args] = spawn.mock.calls[0];
    expect(args).toContain('--location');
    expect(args).not.toContain('--max-redirs');

    const child2 = createMockChild();
    spawn.mockReturnValue(child2);
    spawn.mockClear();

    const config2 = baseConfig();
    config2.maxRedirects = 5;

    const promise2 = adapter(config2);
    emitResponse(child2, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise2;

    [, args] = spawn.mock.calls[0];
    expect(args).toContain('--location');
    expect(args).toContain('--max-redirs');
    expect(args).toContain('5');
  });

  it('rejects when status is invalid', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.validateStatus = (status) => status >= 200 && status < 300;

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 500\r\n\r\n', 'err');

    await expect(promise).rejects.toThrow('Request failed with status code 500');
  });

  it('sends request body via stdin for JSON data', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const config = baseConfig();
    config.method = 'post';
    config.data = { ok: true };

    const promise = adapter(config);
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    const argsLower = args.map((value) => String(value).toLowerCase());
    expect(argsLower).toContain('--data-binary');
    expect(argsLower).toContain('@-');
    expect(child.stdin.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });
});
