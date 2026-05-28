import { createRequire } from 'module';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';

const require = createRequire(import.meta.url);

class PdfParserService {
  constructor() {
    this.pdfParseFn = null;
    this.PDFParseClass = null;
    this.isLoaded = false;
    this._initializeParser();
  }

  _initializeParser() {
    try {
      const pdfParsePkg = require('pdf-parse');
      
      // 1. Check if the package itself is a function (classic pdf-parse)
      if (typeof pdfParsePkg === 'function') {
        this.pdfParseFn = pdfParsePkg;
        logger.info('Resolved classic function-based pdf-parse.');
      } 
      // 2. Check if default is a function
      else if (pdfParsePkg && typeof pdfParsePkg.default === 'function') {
        this.pdfParseFn = pdfParsePkg.default;
        logger.info('Resolved classic default function-based pdf-parse.');
      }
      // 3. Check if PDFParse is a class (modern cyber-fork / pdfjs-dist update)
      else if (pdfParsePkg && typeof pdfParsePkg.PDFParse === 'function') {
        this.PDFParseClass = pdfParsePkg.PDFParse;
        logger.info('Resolved modern class-based PDFParse.');
      }
      // 4. Fallbacks for other known object fields
      else if (pdfParsePkg && typeof pdfParsePkg.pdfParse === 'function') {
        this.pdfParseFn = pdfParsePkg.pdfParse;
        logger.info('Resolved custom pdfParse field function.');
      } else {
        logger.warn('pdf-parse was loaded but no recognizable function or class was found.', {
          keys: pdfParsePkg ? Object.keys(pdfParsePkg) : []
        });
      }
      
      this.isLoaded = true;
    } catch (err) {
      logger.error('Critical failure requiring/initializing pdf-parse package', { error: err.message });
      this.isLoaded = false;
    }
  }

  /**
   * Asserts that the parser is initialized. If not, attempts to re-initialize.
   */
  _ensureParser() {
    if (!this.isLoaded || (!this.pdfParseFn && !this.PDFParseClass)) {
      this._initializeParser();
    }
    
    if (!this.pdfParseFn && !this.PDFParseClass) {
      throw new AppError('The PDF parsing engine is currently unavailable. Please verify dependencies or consult system logs.', 500);
    }
  }

  /**
   * Safe parser entry-point that normalizes classic & modern PDF parse libraries.
   * Returns standard structured data.
   */
  async parse(buffer, options = {}) {
    this._ensureParser();

    if (!buffer || buffer.length === 0) {
      throw new AppError('The uploaded PDF file is empty or corrupted (size is 0 bytes).', 400);
    }

    try {
      // --- Case A: Modern class-based PDFParse ---
      if (this.PDFParseClass) {
        logger.info('Executing modern class-based PDF parsing...');
        const uint8Array = new Uint8Array(buffer);
        const parser = new this.PDFParseClass(uint8Array, { verbosity: 0 });

        const [textData, infoData] = await Promise.all([
          parser.getText(options).catch(err => {
            logger.error('Failed to extract text using modern PDFParse', { error: err.message });
            throw err;
          }),
          parser.getInfo({ parsePageInfo: false }).catch(err => {
            logger.warn('Failed to extract metadata using modern PDFParse (non-blocking)', { error: err.message });
            return { info: {}, total: 0 };
          })
        ]);

        const rawPages = textData.pages || [];
        const pages = rawPages.map((page, idx) => ({
          pageNumber: page.num || idx + 1,
          text: (page.text || '').trim()
        }));

        // Reconstruct consolidated text & page indices to match expected format
        const textParts = [];
        const pageBreakIndices = [];
        
        let currentTextIndex = 0;
        pages.forEach((page) => {
          const pageHeader = `\n--- PAGE_BREAK_${page.pageNumber} ---\n`;
          pageBreakIndices.push(currentTextIndex + 1); // index of --- PAGE_BREAK_
          
          const fullPageText = pageHeader + page.text;
          textParts.push(fullPageText);
          currentTextIndex += fullPageText.length;
        });

        const text = textParts.join('\n');
        const numpages = textData.total || infoData.total || pages.length || 1;

        return {
          text,
          pages,
          pageBreakIndices,
          numpages,
          info: infoData.info || {},
          metadata: infoData.metadata || {},
          version: '1.0.0'
        };
      }

      // --- Case B: Classic function-based pdf-parse ---
      if (this.pdfParseFn) {
        logger.info('Executing classic function-based PDF parsing...');
        
        let pageNum = 0;
        const pageBreakIndices = [];
        
        // Custom render options to mark page breaks in the continuous text stream
        const renderOptions = {
          pagerender: (pageData) => {
            pageNum++;
            return pageData.getTextContent().then((textContent) => {
              const strings = textContent.items.map(item => item.str);
              return `\n--- PAGE_BREAK_${pageNum} ---\n` + strings.join(' ');
            }).catch(err => {
              logger.warn(`Skipped text extraction on page ${pageNum} due to format issues`, { error: err.message });
              return `\n--- PAGE_BREAK_${pageNum} ---\n[Warning: Content on page ${pageNum} is not readable or image-only]`;
            });
          },
          ...options
        };

        const data = await this.pdfParseFn(buffer, renderOptions);
        const text = data.text || '';
        
        // Segment pages based on rendered page boundaries
        const parts = text.split(/--- PAGE_BREAK_\d+ ---/);
        const pages = [];
        let actualPageIndex = 1;
        
        parts.forEach((part) => {
          const trimmed = part.trim();
          if (trimmed) {
            pages.push({
              pageNumber: actualPageIndex,
              text: trimmed
            });
            actualPageIndex++;
          }
        });

        if (pages.length === 0 && text.trim()) {
          pages.push({ pageNumber: 1, text: text.trim() });
        }

        // Locate indices of PAGE_BREAK inside the consolidated text
        const regex = /--- PAGE_BREAK_\d+ ---/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          pageBreakIndices.push(match.index);
        }

        return {
          text,
          pages,
          pageBreakIndices,
          numpages: data.numpages || pages.length || 1,
          info: data.info || {},
          metadata: data.metadata || {},
          version: data.version || '1.0.0'
        };
      }

      throw new Error('No executable parsing provider was resolved.');
    } catch (err) {
      logger.error('Failed to parse PDF document', { error: err.message, stack: err.stack });
      
      // Classify error type to throw human-understandable messages
      if (err.message?.includes('Password') || err.message?.includes('encrypted') || err.name === 'PasswordException') {
        throw new AppError('This PDF document is encrypted or password-protected. Please upload an unlocked text PDF.', 422);
      }
      if (err.message?.includes('Invalid') || err.name === 'InvalidPDFException') {
        throw new AppError('The PDF file is malformed or invalid. Please ensure it is a standard non-corrupted PDF.', 422);
      }
      
      throw new AppError(`PDF extraction failed: ${err.message || 'The document format is incompatible or corrupt.'}`, 422);
    }
  }

  async extractText(buffer) {
    const data = await this.parse(buffer);
    return {
      text: data.text || '',
      info: data.info || {},
      metadata: data.metadata || {},
      numpages: data.numpages || 1,
    };
  }

  async extractWithPages(buffer) {
    return this.parse(buffer);
  }

  async isScannedPdf(buffer) {
    try {
      const data = await this.parse(buffer);
      const text = data.text || '';
      const charCount = text.replace(/\s+/g, '').length;
      const numpages = data.numpages || 1;
      
      const charsPerPage = charCount / numpages;
      const isScanned = charsPerPage < 150;
      
      logger.info('PDF scanned detection result', {
        charCount,
        numpages,
        charsPerPage,
        isScanned
      });
      
      return isScanned;
    } catch (err) {
      logger.error('Failed to run scanned check on PDF', { error: err.message });
      return false; // Graceful fail-safe fallback to prevent blocking
    }
  }

  detectStructure(text) {
    if (!text) return { headings: [], listsCount: 0, codeBlocksCount: 0 };

    const lines = text.split('\n');
    const headings = [];
    let listsCount = 0;
    let codeBlocksCount = 0;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Markdown headings
      if (/^#{1,6}\s+/.test(line)) {
        headings.push({ lineIndex: i, text: line.replace(/^#+\s+/, ''), type: 'markdown' });
        continue;
      }

      // Common headers: ALL CAPS lines that are relatively short
      if (/^[A-Z\s0-9.,:;&()\-']{5,60}$/.test(line) && line.split(/\s+/).length >= 2 && !line.endsWith('.')) {
        headings.push({ lineIndex: i, text: line, type: 'caps' });
        continue;
      }

      // Lists
      if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
        listsCount++;
        continue;
      }

      // Code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) codeBlocksCount++;
      }
    }

    return {
      headings,
      listsCount,
      codeBlocksCount,
    };
  }
}

export default PdfParserService;
