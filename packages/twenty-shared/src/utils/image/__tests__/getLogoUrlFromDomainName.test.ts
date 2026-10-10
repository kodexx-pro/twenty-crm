import {
  getLogoUrlFromDomainName,
  sanitizeURL,
} from '@/utils/image/getLogoUrlFromDomainName';

describe('sanitizeURL', () => {
  test('should sanitize the URL correctly', () => {
    expect(sanitizeURL('http://example.com/')).toBe('example.com');
    expect(sanitizeURL('https://www.example.com/')).toBe('example.com');
    expect(sanitizeURL('www.example.com')).toBe('example.com');
    expect(sanitizeURL('example.com')).toBe('example.com');
    expect(sanitizeURL('example.com/')).toBe('example.com');
  });

  test('should handle undefined input', () => {
    expect(sanitizeURL(undefined)).toBe('');
  });
});

describe('getLogoUrlFromDomainName', () => {
  test('does not request a third-party logo when no service is configured', () => {
    expect(getLogoUrlFromDomainName('example.com')).toBeUndefined();
  });

  test.each([
    'example.com',
    'http://example.com/',
    'https://www.example.com/',
    'www.example.com',
    'example.com/',
  ])('uses the configured logo service for %s', (domain) => {
    expect(getLogoUrlFromDomainName(domain, 'https://logos.example.org/')).toBe(
      'https://logos.example.org/example.com',
    );
  });

  test('should handle undefined input', () => {
    expect(getLogoUrlFromDomainName(undefined)).toBe(undefined);
  });
});
