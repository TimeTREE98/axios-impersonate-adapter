export const splitHeadersAndBody = (output: Buffer): { rawHeaders: string; body: Buffer } => {
  if (!output.length) {
    return { rawHeaders: '', body: output };
  }

  const httpPrefixLength = 5;
  let offset = 0;
  let lastHeaderEnd = -1;

  const startsWithHttp = (start: number): boolean =>
    output.length - start >= httpPrefixLength &&
    output[start] === 0x48 &&
    output[start + 1] === 0x54 &&
    output[start + 2] === 0x54 &&
    output[start + 3] === 0x50 &&
    output[start + 4] === 0x2f;

  const findHeaderEnd = (start: number): number => {
    const crlfIndex = output.indexOf('\r\n\r\n', start);
    const lfIndex = output.indexOf('\n\n', start);
    if (crlfIndex === -1 && lfIndex === -1) {
      return -1;
    }
    if (crlfIndex === -1) {
      return lfIndex + 2;
    }
    if (lfIndex === -1) {
      return crlfIndex + 4;
    }
    return crlfIndex < lfIndex ? crlfIndex + 4 : lfIndex + 2;
  };

  while (startsWithHttp(offset)) {
    const headerEnd = findHeaderEnd(offset);
    if (headerEnd === -1) {
      break;
    }
    lastHeaderEnd = headerEnd;
    if (startsWithHttp(headerEnd)) {
      offset = headerEnd;
      continue;
    }
    break;
  }

  if (lastHeaderEnd === -1) {
    return { rawHeaders: '', body: output };
  }

  return {
    rawHeaders: output.slice(0, lastHeaderEnd).toString('utf8'),
    body: output.slice(lastHeaderEnd),
  };
};

export const parseStatus = (rawHeaders: string): number => {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return 0;
  }

  const lastBlockIndex = blocks.length - 1;
  const lastBlockLines = blocks[lastBlockIndex].split(/\r?\n/).filter(Boolean);
  const statusLine = lastBlockLines[0] || '';
  const statusMatch = statusLine.match(/^HTTP\/\d+(?:\.\d+)?\s+(\d+)(?:\s+(.*))?$/i);

  return statusMatch ? Number(statusMatch[1]) : 0;
};
