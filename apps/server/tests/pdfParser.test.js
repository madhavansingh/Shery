import { vi, describe, it, expect, beforeEach } from 'vitest';
import PdfParserService from '../src/services/workspace/pdfParser.service.js';
import AppError from '../src/utils/AppError.js';

describe('PdfParserService', () => {
  let parserService;

  beforeEach(() => {
    vi.resetModules();
    parserService = new PdfParserService();
  });

  it('should instantiate and attempt package resolution', () => {
    expect(parserService).toBeDefined();
    expect(parserService.isLoaded).toBe(true);
  });

  it('should correctly classify encrypted PDF exceptions', async () => {
    // Force classic flow and mock rejection with encryption signature
    parserService.PDFParseClass = null;
    parserService.pdfParseFn = vi.fn().mockRejectedValue(new Error('PasswordException: encrypted file'));
    
    await expect(parserService.extractText(Buffer.from('dummy'))).rejects.toThrow(
      'This PDF document is encrypted or password-protected.'
    );
  });

  it('should correctly classify malformed PDF exceptions', async () => {
    // Force classic flow and mock rejection with invalid format signature
    parserService.PDFParseClass = null;
    parserService.pdfParseFn = vi.fn().mockRejectedValue(new Error('InvalidPDFException: corrupt header'));
    
    await expect(parserService.extractText(Buffer.from('dummy'))).rejects.toThrow(
      'The PDF file is malformed or invalid.'
    );
  });

  it('should correctly run scanned check based on character density', async () => {
    // Mock the parser returning high/low density character pages
    vi.spyOn(parserService, 'parse').mockResolvedValue({
      text: 'Hello World',
      numpages: 1,
      pageBreakIndices: [],
      pages: [{ pageNumber: 1, text: 'Hello World' }],
      info: {},
      metadata: {}
    });

    // 10 alphanumeric characters / 1 page = 10 chars/page (<150 is scanned)
    const isScannedLowDensity = await parserService.isScannedPdf(Buffer.from('dummy'));
    expect(isScannedLowDensity).toBe(true);

    vi.spyOn(parserService, 'parse').mockResolvedValue({
      text: 'A '.repeat(200), // 200 characters
      numpages: 1,
      pageBreakIndices: [],
      pages: [{ pageNumber: 1, text: 'A '.repeat(200) }],
      info: {},
      metadata: {}
    });

    // 200 characters / 1 page = 200 chars/page (>=150 is not scanned)
    const isScannedHighDensity = await parserService.isScannedPdf(Buffer.from('dummy'));
    expect(isScannedHighDensity).toBe(false);
  });
});
