import '../src/types';

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough, type Readable, type Writable } from 'node:stream';

import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { CookieJar } from 'tough-cookie';

import { adapter } from '../src/adapter';

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

const waitForSpawn = async () => {
  const start = Date.now();
  while (spawn.mock.calls.length === 0) {
    if (Date.now() - start > 1000) throw new Error('Timeout waiting for spawn');
    await new Promise((r) => setTimeout(r, 10));
  }
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

describe('adapter cookies', () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  it('sends cookies from jar via --cookie', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const jar = new CookieJar();
    await jar.setCookie('foo=bar', 'https://example.com');

    const config = baseConfig();
    config.jar = jar;

    const promise = adapter(config);
    await waitForSpawn();
    emitResponse(child, 'HTTP/2 200\r\n\r\n', 'ok');
    await promise;

    const [, args] = spawn.mock.calls[0];
    const cookieIndex = args.indexOf('-b');
    expect(cookieIndex).toBeGreaterThan(-1);
    expect(args[cookieIndex + 1]).toContain('foo=bar');
  });

  it('writes Set-Cookie headers back into jar', async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    const jar = new CookieJar();
    const config = baseConfig();
    config.jar = jar;

    const promise = adapter(config);

    // Wait for spawn to be called
    await waitForSpawn();
    emitResponse(child, 'HTTP/2 200\r\nset-cookie: baz=qux; Path=/\r\n\r\n', 'ok');
    await promise;

    // Check if cookie is in jar
    const cookies = await jar.getCookies('https://example.com');
    expect(cookies).toHaveLength(1);
    expect(cookies[0].key).toBe('baz');
    expect(cookies[0].value).toBe('qux');
  });
});
