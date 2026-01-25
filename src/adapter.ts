import { spawn } from 'node:child_process';
import path from 'node:path';
import { Readable } from 'node:stream';

import { AxiosAdapter, AxiosError, AxiosHeaders, AxiosPromise, InternalAxiosRequestConfig, mergeConfig } from 'axios';

import { DEFAULTS } from './impersonate';
import { parseStatus, splitHeadersAndBody } from './utils/headers';

export const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig): AxiosPromise => {
  const binaryPath = path.join(__dirname, '..', 'bin', 'curl-impersonate');
  const { args: defaultArgs, headers: defaultHeaders } = DEFAULTS[config.impersonate] ?? DEFAULTS['chrome142'];

  return new Promise((resolve, reject) => {
    const args = [...defaultArgs, '--silent', '--show-error', '--include', '-X', config.method.toUpperCase()];

    // timeout
    if (config.timeout !== 0) {
      args.push('--max-time', String(config.timeout! / 1000));
    }

    // redirect
    if (config.maxRedirects === undefined) {
      args.push('--location');
    } else {
      args.push('--location', '--max-redirs', String(config.maxRedirects));
    }

    // proxy
    if (!!config.proxy) {
      const protocol = (config.proxy.protocol ?? 'http').replace(/:\/\/$/, '');

      const hasScheme = config.proxy.host.includes('://');
      let proxyUrl = hasScheme ? config.proxy.host : `${protocol}://${config.proxy.host}`;

      if (config.proxy.port && !/:\d+$/.test(proxyUrl)) {
        proxyUrl = `${proxyUrl}:${config.proxy.port}`;
      }

      args.push('--proxy', proxyUrl);

      if (config.proxy.auth?.username) {
        const password = config.proxy.auth.password;
        const credentials = password === undefined ? config.proxy.auth.username : `${config.proxy.auth.username}:${password}`;
        args.push('--proxy-user', credentials);
      }
    }

    // headers
    const axiosHeaders = AxiosHeaders.from(config.headers);
    const defaultAccept = 'application/json, text/plain, */*';
    const accept = axiosHeaders.get('Accept');
    if (typeof accept === 'string' && accept.trim() === defaultAccept) {
      // Ignore axios default Accept so impersonate defaults can apply.
      axiosHeaders.delete('Accept');
    }

    let requestBody: Buffer | string | Readable | undefined;
    const isReadable = (value: unknown): value is Readable => value instanceof Readable;

    if (config.data !== undefined && config.data !== null) {
      if (isReadable(config.data)) {
        requestBody = config.data;
      } else if (Buffer.isBuffer(config.data)) {
        requestBody = config.data;
      } else if (config.data instanceof ArrayBuffer) {
        requestBody = Buffer.from(config.data);
      } else if (ArrayBuffer.isView(config.data)) {
        requestBody = Buffer.from(config.data.buffer, config.data.byteOffset, config.data.byteLength);
      } else if (config.data instanceof URLSearchParams) {
        requestBody = config.data.toString();
      } else if (typeof config.data === 'string') {
        requestBody = config.data;
      } else if (typeof config.data === 'object') {
        requestBody = JSON.stringify(config.data);
      }
    }

    const { headers } = mergeConfig({ headers: defaultHeaders }, { headers: axiosHeaders });

    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue;
      args.push('-H', `${key}: ${value}`);
    }

    // url
    const url = new URL(`${config.baseURL ?? ''}${config.url ?? ''}`);
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    args.push(url.toString());

    if (requestBody !== undefined) {
      args.push('--data-binary', '@-');
    }

    // execute
    const child = spawn(binaryPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    // TODO: Handle error
    child.on('error', reject);

    child.on('close', (code) => {
      const { rawHeaders, body } = splitHeadersAndBody(Buffer.concat(stdoutChunks));
      const headers = new AxiosHeaders(rawHeaders);
      const status = parseStatus(rawHeaders);

      if (code === 0 && config.validateStatus(status)) {
        resolve({
          status: status,
          statusText: '',
          headers: headers,
          data: body.toString('utf-8'),
          config,
          // request,
        });
      } else {
        reject(new AxiosError(`Request failed with status code ${status}, curl code ${code}`));
      }
    });

    if (requestBody && isReadable(requestBody)) {
      requestBody.pipe(child.stdin);
    } else if (requestBody !== undefined) {
      child.stdin.end(requestBody);
    } else {
      child.stdin.end();
    }
  });
};
