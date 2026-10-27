import { describe, expect, it } from 'vitest';
import { formatFileSize } from '@/lib/utils/format';
import { MAX_ZIP_BYTES, MAX_ZIP_LABEL, validateZipFile } from '@/lib/validation/zip-file';

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe('validateZipFile: type', () => {
  it.each([
    ['application/zip', 'what most browsers report'],
    ['application/x-zip-compressed', 'what Windows reports'],
    ['application/x-zip', 'an older name'],
    ['', 'nothing at all, which some systems do'],
    ['application/octet-stream', 'a generic binary file'],
  ])('accepts a .zip reported as "%s" (%s)', (type) => {
    expect(validateZipFile(file('code.zip', type))).toBeNull();
  });

  it('accepts a capitalised extension', () => {
    expect(validateZipFile(file('CODE.ZIP', 'application/zip'))).toBeNull();
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['code.tar.gz', 'application/gzip'],
    ['code.rar', 'application/vnd.rar'],
    ['code.7z', 'application/x-7z-compressed'],
    ['code', 'application/zip'],
    ['code.zip.exe', 'application/x-msdownload'],
    ['code.zipx', 'application/zip'],
    ['zip', 'application/zip'],
  ])('rejects "%s" (%s): the extension is wrong', (name, type) => {
    expect(validateZipFile(file(name, type))).toBe(
      `"${name}" is not a .zip file. Compress your code into a .zip and choose that.`,
    );
  });

  it('rejects a .zip whose type says it is something else', () => {
    expect(validateZipFile(file('code.zip', 'text/html'))).toMatch(/is not a \.zip file/);
    expect(validateZipFile(file('code.zip', 'image/png'))).toMatch(/is not a \.zip file/);
  });
});

describe('validateZipFile: size', () => {
  it('allows exactly 50 MB and rejects one byte more', () => {
    expect(MAX_ZIP_BYTES).toBe(52_428_800);
    expect(validateZipFile(file('a.zip', 'application/zip', MAX_ZIP_BYTES))).toBeNull();
    expect(validateZipFile(file('a.zip', 'application/zip', MAX_ZIP_BYTES + 1))).toMatch(
      /over the 50 MB limit/,
    );
  });

  it('says how big the file is and what the limit is', () => {
    expect(validateZipFile(file('big.zip', 'application/zip', 62.4 * 1024 * 1024))).toBe(
      '"big.zip" is 62.4 MB, which is over the 50 MB limit. Remove large files such as build output and try again.',
    );
  });

  it('rejects an empty file', () => {
    expect(validateZipFile(file('empty.zip', 'application/zip', 0))).toBe(
      '"empty.zip" is empty. Choose a .zip that contains your code.',
    );
  });

  it('checks the type before the size, so a huge PDF is told it is not a zip', () => {
    expect(validateZipFile(file('big.pdf', 'application/pdf', MAX_ZIP_BYTES * 2))).toMatch(
      /is not a \.zip file/,
    );
  });

  it('labels the limit as 50 MB', () => {
    expect(MAX_ZIP_LABEL).toBe('50 MB');
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [-5, '0 B'],
    [Number.NaN, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [840 * 1024, '840 KB'],
    [1024 * 1024, '1 MB'],
    [2.5 * 1024 * 1024, '2.5 MB'],
    [50 * 1024 * 1024, '50 MB'],
    [3 * 1024 ** 3, '3 GB'],
    [5000 * 1024 ** 3, '5000 GB'],
  ])('%s bytes is %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
