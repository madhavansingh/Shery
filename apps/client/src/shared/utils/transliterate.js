export const LOANWORD_MAP = {
  // ML / DS / AI
  'मशीन': 'machine', 'लर्निंग': 'learning', 'लर्निग': 'learning',
  'डेटा': 'data', 'डाटा': 'data', 'डेटासेट': 'dataset',
  'साइंस': 'science', 'सायंस': 'science', 'साइंटिस्ट': 'scientist',
  'आर्टिफिशियल': 'artificial', 'इंटेलिजेंस': 'intelligence',
  'न्यूरल': 'neural', 'नेटवर्क': 'network',
  'डीप': 'deep', 'ट्रांसफार्मर': 'transformer', 'अटेंशन': 'attention',
  'मॉडल': 'model', 'ट्रेनिंग': 'training', 'टेस्टिंग': 'testing',
  'वैलिडेशन': 'validation', 'ओवरफिटिंग': 'overfitting',
  'अल्गोरिदम': 'algorithm', 'एल्गोरिदम': 'algorithm',
  'रिग्रेशन': 'regression', 'क्लासिफिकेशन': 'classification',
  'क्लस्टरिंग': 'clustering', 'फीचर': 'feature', 'लेबल': 'label',
  'एम्बेडिंग': 'embedding', 'टोकन': 'token', 'टोकनाइजेशन': 'tokenization',
  'इनपुट': 'input', 'आउटपुट': 'output', 'लेयर': 'layer',
  'वेट': 'weight', 'बायस': 'bias', 'ग्रेडिएंट': 'gradient',
  'ऑप्टिमाइजर': 'optimizer', 'लॉस': 'loss', 'एक्यूरेसी': 'accuracy',
  'प्रिडिक्शन': 'prediction', 'प्रोबेबिलिटी': 'probability',
  'मैट्रिक्स': 'matrix', 'वेक्टर': 'vector',
  // Tech / programming
  'कंप्यूटर': 'computer', 'सॉफ्टवेयर': 'software', 'हार्डवेयर': 'hardware',
  'प्रोग्रामिंग': 'programming', 'कोडिंग': 'coding', 'कोड': 'code',
  'डेटाबेस': 'database', 'क्लाउड': 'cloud', 'सर्वर': 'server',
  'फ्रेमवर्क': 'framework', 'लाइब्रेरी': 'library', 'फंक्शन': 'function',
  'वेरिएबल': 'variable', 'इंटीग्रेशन': 'integration', 'डिप्लॉयमेंट': 'deployment',
  'इंटरनेट': 'internet', 'वेबसाइट': 'website', 'एपीआई': 'API',
  'एप्लीकेशन': 'application', 'एप्लिकेशन': 'application',
  'टेक्नोलॉजी': 'technology', 'इंजीनियरिंग': 'engineering',
  'डेवलपमेंट': 'development', 'टूल': 'tool', 'प्लेटफॉर्म': 'platform',
  // Common Hinglish filler / grammar
  'ऑलमोस्ट': 'almost', 'बेसिकली': 'basically', 'एक्चुअली': 'actually',
  'लिटरली': 'literally', 'प्रॉब्लम': 'problem', 'सॉल्यूशन': 'solution',
  'एग्जाम्पल': 'example', 'कॉन्सेप्ट': 'concept', 'टॉपिक': 'topic',
  'वीडियो': 'video', 'चैनल': 'channel', 'कोर्स': 'course',
  'लेक्चर': 'lecture', 'स्टूडेंट': 'student', 'टीचर': 'teacher',
  'पॉइंट': 'point', 'नोट्स': 'notes', 'क्वेश्चन': 'question',
  'आंसर': 'answer', 'रिजल्ट': 'result', 'स्कोर': 'score',
};

export const CONSONANT_MAP = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh',
  'न': 'n', 'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh',
  'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l',
  'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

export const VOWEL_MAP = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

export const MATRA_MAP = {
  'ा': 'aa', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
};

const HALANT = '्';
const ANUSVARA = 'ं';
const VISARGA = 'ः';
const CHANDRABINDU = 'ँ';

export function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}

export function transliterateDevanagari(text) {
  if (!text) return '';

  const punct = text.match(/[^a-zA-Z\u0900-\u097F]*$/)?.[0] ?? '';
  const core = text.slice(0, text.length - punct.length);
  if (LOANWORD_MAP[core]) return LOANWORD_MAP[core] + punct;

  const chars = [...text];
  let result = '';
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];
    const next = chars[i + 1] ?? '';

    if (CONSONANT_MAP[ch] !== undefined) {
      const base = CONSONANT_MAP[ch];

      if (next === HALANT) {
        result += base;
        i += 2;
      } else if (MATRA_MAP[next] !== undefined) {
        result += base + MATRA_MAP[next];
        i += 2;
      } else {
        result += base + 'a';
        i += 1;
      }
    } else if (VOWEL_MAP[ch] !== undefined) {
      result += VOWEL_MAP[ch];
      i += 1;
    } else if (MATRA_MAP[ch] !== undefined) {
      result += MATRA_MAP[ch];
      i += 1;
    } else if (ch === ANUSVARA || ch === CHANDRABINDU) {
      result += 'n';
      i += 1;
    } else if (ch === VISARGA) {
      result += 'h';
      i += 1;
    } else if (/[\u0900-\u097F]/.test(ch)) {
      i += 1;
    } else {
      result += ch;
      i += 1;
    }
  }

  result = result.replace(/a([^aeiou\s]*)$/, '$1');
  return result.replace(/\s+/g, ' ').trim();
}

export function normalizeWord(word, _language) {
  if (!word) return '';

  if (hasDevanagari(word)) {
    return transliterateDevanagari(word) || '';
  }

  return word;
}
