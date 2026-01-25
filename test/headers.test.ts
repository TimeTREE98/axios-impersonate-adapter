import { parseStatus, splitHeadersAndBody } from '../src/utils/headers';

describe('headers utils', () => {
  it('splits headers and body from output', () => {
    const output = Buffer.from('HTTP/2 200 OK\r\nX-Test: 1\r\n\r\nhello');
    const { rawHeaders, body } = splitHeadersAndBody(output);

    expect(rawHeaders).toContain('HTTP/2 200 OK');
    expect(rawHeaders).toContain('X-Test: 1');
    expect(body.toString('utf8')).toBe('hello');
  });

  it('parses the last status code from multiple header blocks', () => {
    const rawHeaders = ['HTTP/2 301', 'location: https://example.com/next', '', 'HTTP/2 200', 'content-type: text/html', ''].join('\r\n');

    expect(parseStatus(rawHeaders)).toBe(200);
  });
});
