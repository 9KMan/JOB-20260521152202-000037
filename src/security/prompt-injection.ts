// Simple heuristic-based prompt injection detection
// In production, this would use an LLM-based eval hook

const INJECTION_PATTERNS = [
  /\b(ignore previous|ignore all|disregard)\b/i,
  /\b(you are now|you are a)\b/i,
  /\[SYSTEM\]/i,
  /{{.*?}}/,
  /<xml>.*?<\/xml>/is,
];

export class PromptInjectionDetector {
  detect(text: string): { detected: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        score += 0.3;
        reasons.push(`Pattern matched: ${pattern.toString()}`);
      }
    }

    // Check for unusual length
    if (text.length > 10000) {
      score += 0.2;
      reasons.push('Unusually long text');
    }

    // Check for base64 or encoded content
    if (/[A-Za-z0-9+/=]{100,}/.test(text)) {
      score += 0.2;
      reasons.push('Contains long base64-like content');
    }

    return {
      detected: score >= 0.5,
      score,
      reasons,
    };
  }

  sanitizeDescription(description: string): string {
    const result = this.detect(description);
    if (result.detected) {
      // Replace potentially dangerous content
      return description
        .replace(/\[SYSTEM\]/gi, '[REDACTED]')
        .replace(/{{.*?}}/g, '[REDACTED]');
    }
    return description;
  }
}