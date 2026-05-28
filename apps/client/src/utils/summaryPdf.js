/**
 * summaryPdf.js
 * Turns a markdown AI summary string into a polished jsPDF document.
 */
import { jsPDF } from 'jspdf';

const PALETTE = {
  bg:           [255, 255, 255],
  primary:      [232,  87,  42],
  text:         [30,   30,  30],
  textMuted:    [80,   80,  80],
  divider:      [220, 220, 220],
  cardBg:       [249, 250, 251], // light gray for Q&A
};

const PAGE = { w: 210, h: 297, margin: 18 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;

function rgb(doc, color) { doc.setTextColor(...color); }
function fill(doc, color) { doc.setFillColor(...color); }
function draw(doc, color) { doc.setDrawColor(...color); }

function wrapLines(doc, text, maxW, fontSize) {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text, maxW);
}

export async function downloadSummaryPDF(summaryMarkdown, lessonTitle = 'Lecture', opts = {}) {
  const brandName   = opts.brandName   || 'SheryAI';
  const headerTitle = opts.headerTitle || 'AI Lecture Summary';

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = 0;

  // Header band (primary color)
  fill(doc, PALETTE.primary);
  doc.rect(0, 0, PAGE.w, 18, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(doc, PALETTE.bg);
  doc.text(`${brandName} - ${headerTitle}`, PAGE.margin, 11);

  y = 30;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  rgb(doc, PALETTE.text);
  const titleLines = wrapLines(doc, lessonTitle, CONTENT_W, 16);
  doc.text(titleLines, PAGE.margin, y);
  y += titleLines.length * 7 + 8;

  const lines = summaryMarkdown.split('\n');

  const checkPage = (needed = 10) => {
    if (y + needed > PAGE.h - 18) {
      doc.addPage();
      y = PAGE.margin + 5;
    }
  };

  let inFlashcard = false;
  let flashQ = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      y += 3;
      continue;
    }

    // ### Heading 3
    if (trimmed.startsWith('### ')) {
      checkPage(12);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      rgb(doc, PALETTE.text);
      doc.text(trimmed.slice(4), PAGE.margin, y);
      y += 6;
      inFlashcard = trimmed.toLowerCase().includes('flashcard');
      continue;
    }

    // ## Heading 2
    if (trimmed.startsWith('## ')) {
      checkPage(14);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      rgb(doc, PALETTE.text);
      doc.text(trimmed.slice(3), PAGE.margin, y);
      y += 7;
      continue;
    }

    // # Heading 1
    if (trimmed.startsWith('# ')) {
      checkPage(16);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      rgb(doc, PALETTE.text);
      doc.text(trimmed.slice(2), PAGE.margin, y);
      y += 8;
      continue;
    }

    // Flashcard Q&A (Q: / A:)
    if (inFlashcard && trimmed.match(/^Q\d*[:)]/i)) {
      checkPage(12);
      flashQ = trimmed.replace(/^Q\d*[:)]\s*/i, '');
      continue;
    }
    if (inFlashcard && trimmed.match(/^A\d*[:)]/i) && flashQ) {
      checkPage(18);
      const answerText = trimmed.replace(/^A\d*[:)]\s*/i, '');
      
      const qLines = wrapLines(doc, `Q: ${flashQ}`, CONTENT_W - 6, 9.5);
      const aLines = wrapLines(doc, `A: ${answerText}`, CONTENT_W - 6, 9.5);
      
      const boxH = (qLines.length + aLines.length) * 5 + 6;
      checkPage(boxH);
      
      fill(doc, PALETTE.cardBg);
      draw(doc, PALETTE.divider);
      doc.setLineWidth(0.2);
      doc.roundedRect(PAGE.margin, y, CONTENT_W, boxH, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      rgb(doc, PALETTE.text);
      doc.text(qLines, PAGE.margin + 3, y + 5);
      
      doc.setFont('helvetica', 'normal');
      rgb(doc, PALETTE.textMuted);
      doc.text(aLines, PAGE.margin + 3, y + 5 + qLines.length * 5);
      
      y += boxH + 4;
      flashQ = '';
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2);
      const wrapped = wrapLines(doc, content, CONTENT_W - 6, 9.5);
      checkPage(wrapped.length * 5 + 2);

      doc.setFont('helvetica', 'normal');
      rgb(doc, PALETTE.text);
      doc.text('•', PAGE.margin + 2, y + 3.5);
      doc.text(wrapped, PAGE.margin + 6, y + 3.5, { lineHeightFactor: 1.4 });
      y += wrapped.length * 5 + 1;
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2];
      const wrapped = wrapLines(doc, content, CONTENT_W - 8, 9.5);
      checkPage(wrapped.length * 5 + 2);

      doc.setFont('helvetica', 'normal');
      rgb(doc, PALETTE.text);
      doc.text(`${num}.`, PAGE.margin + 1, y + 3.5);
      doc.text(wrapped, PAGE.margin + 7, y + 3.5, { lineHeightFactor: 1.4 });
      y += wrapped.length * 5 + 1;
      continue;
    }

    // Divider
    if (trimmed === '---' || trimmed === '***') {
      y += 2;
      draw(doc, PALETTE.divider);
      doc.setLineWidth(0.2);
      doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y);
      y += 4;
      continue;
    }

    // Regular paragraph
    const wrapped = wrapLines(doc, trimmed, CONTENT_W, 9.5);
    checkPage(wrapped.length * 5 + 2);
    doc.setFont('helvetica', 'normal');
    rgb(doc, PALETTE.text);
    doc.text(wrapped, PAGE.margin, y + 3.5, { lineHeightFactor: 1.4 });
    y += wrapped.length * 5 + 2;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    rgb(doc, PALETTE.textMuted);
    doc.text(`Page ${p} of ${totalPages}`, PAGE.w / 2, PAGE.h - 10, { align: 'center' });
  }

  const safe = lessonTitle.replace(/[^a-z0-9]+/gi, '-').slice(0, 48).toLowerCase();
  doc.save(`${brandName.toLowerCase()}-summary-${safe}.pdf`);
}
