import { describe, it, expect } from 'vitest';
import { transliterateDevanagari, hasDevanagari } from './transliterate.js';

describe('Devanagari Transliteration Utility', () => {
  it('should detect Devanagari text correctly', () => {
    expect(hasDevanagari('मशीन')).toBe(true);
    expect(hasDevanagari('learning')).toBe(false);
    expect(hasDevanagari('12345')).toBe(false);
  });

  it('should map whole-word loanwords from LOANWORD_MAP', () => {
    expect(transliterateDevanagari('मशीन')).toBe('machine');
    expect(transliterateDevanagari('लर्निंग')).toBe('learning');
    expect(transliterateDevanagari('डेटा')).toBe('data');
  });

  it('should transliterate generic Devanagari character pairs', () => {
    // का is subject to final schwa deletion, mapping to 'ka'
    expect(transliterateDevanagari('का')).toBe('ka');
    expect(transliterateDevanagari('कि')).toBe('ki');
  });
});
