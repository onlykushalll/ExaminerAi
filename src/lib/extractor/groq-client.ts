import OpenAI from 'openai';
import type { ExtractionResult } from './types';

const getApiKey = (keyName: 'GROQ_API_KEY' | 'OPENROUTER_API_KEY') => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(keyName);
    if (saved && saved.trim().length > 0) return saved;
  }
  // @ts-ignore
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const viteVal = metaEnv[`VITE_${keyName}`];
  if (viteVal) return viteVal;

  if (typeof process !== 'undefined' && process.env) {
    return process.env[keyName];
  }
  return '';
};

// Initialize OpenAI client pointing to Groq's endpoint
const getGroqClient = () => {
  const apiKey = getApiKey('GROQ_API_KEY');
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Please configure it in Settings.');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
    dangerouslyAllowBrowser: true,
  });
};

// Initialize OpenAI client pointing to OpenRouter's endpoint
const getOpenRouterClient = () => {
  const apiKey = getApiKey('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set. Please configure it in Settings.');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    dangerouslyAllowBrowser: true,
  });
};

// Get the active provider client and model chain dynamically
const getAIChain = (type: 'text' | 'vision'): { client: OpenAI; model: string }[] => {
  const openRouterKey = getApiKey('OPENROUTER_API_KEY');
  const groqKey = getApiKey('GROQ_API_KEY');
  const chain: { client: OpenAI; model: string }[] = [];

  // 1. Primary: Groq (if key is set)
  if (groqKey && groqKey.trim().length > 0) {
    const groqClient = getGroqClient();
    if (type === 'vision') {
      chain.push({ client: groqClient, model: 'llama-3.2-11b-vision-preview' });
    } else {
      chain.push({ client: groqClient, model: 'llama-3.3-70b-versatile' });
      chain.push({ client: groqClient, model: 'llama-3.1-8b-instant' });
    }
  }

  // 2. Fallbacks: OpenRouter (if key is set)
  if (openRouterKey && openRouterKey.trim().length > 0) {
    const openRouterClient = getOpenRouterClient();
    if (type === 'vision') {
      chain.push({
        client: openRouterClient,
        model: process.env.OPENROUTER_MODEL_VISION || 'google/gemma-2-9b-it:free',
      });
    } else {
      if (process.env.OPENROUTER_MODEL_TEXT) {
        chain.push({ client: openRouterClient, model: process.env.OPENROUTER_MODEL_TEXT });
      }
      chain.push({ client: openRouterClient, model: 'nvidia/nemotron-3-ultra-550b-a55b:free' });
      chain.push({ client: openRouterClient, model: 'openai/gpt-oss-120b:free' });
      chain.push({ client: openRouterClient, model: 'nvidia/nemotron-3-super-120b-a12b:free' });
    }
  }

  if (chain.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENROUTER_API_KEY environment variable is set.');
  }

  return chain;
};

/**
 * Checks if Groq or OpenRouter AI parsing is configured and enabled.
 */
export function isGroqEnabled(): boolean {
  const groqKey = getApiKey('GROQ_API_KEY');
  const openRouterKey = getApiKey('OPENROUTER_API_KEY');
  return Boolean(
    (groqKey && groqKey.trim().length > 0) ||
    (openRouterKey && openRouterKey.trim().length > 0)
  );
}

/**
 * Helper to run completions with fallback support
 */
async function createChatCompletionWithFallback(
  type: 'text' | 'vision',
  params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const chain = getAIChain(type);
  let lastError: any = null;

  for (let i = 0; i < chain.length; i++) {
    const { client, model } = chain[i];
    console.log(`[ai-client] Requesting completion using model: ${model} (Attempt ${i + 1}/${chain.length})`);
    try {
      const response = await client.chat.completions.create({
        ...params,
        model,
      });
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error(`Invalid response shape (no choices): ${JSON.stringify(response)}`);
      }
      return response;
    } catch (err: any) {
      console.warn(`[ai-client] Model ${model} failed:`, err?.message || err);
      lastError = err;
      if (i < chain.length - 1) {
        console.log(`[ai-client] Sleeping for 1s before trying fallback model...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error('All fallback models failed.');
}

/**
 * Use Llama 3.2 Vision to extract clean text from a base64 page image.
 * Used as last-resort OCR fallback when local GLM-OCR is offline.
 */
export async function ocrPageWithGroqVision(base64Image: string): Promise<string> {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  const response = await createChatCompletionWithFallback('vision', {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Perform OCR on this exam paper page image. Extract and output all readable text exactly as printed. Do not summarize or add conversational filler. If there are math equations, write them in plain text or standard math symbols. Preserve question numbers, section headers, and option labels (A, B, C, D) exactly as shown.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Deterministic solution-section detector.
 * Scans raw text for solution markers BEFORE the LLM call.
 * If found, hasSolutions is forced to true regardless of LLM output.
 */
function detectSolutionsDeterministically(text: string, answerKeyText?: string): boolean {
  if (answerKeyText && answerKeyText.trim().length > 20) return true;

  const solutionMarkers = [
    /^\s*solutions?\s*[:\-\n]/im,
    /^\s*answer\s*key\s*[:\-\n]/im,
    /^\s*marking\s*scheme\s*[:\-\n]/im,
    /^\s*answers?\s*[:\-\n]/im,
    /\bstep\s*1\s*[:\-]/i,
    /\bgiven\s*data\s*[:\-]/i,
    /\busing\s*ohm'?s?\s*law\b/i,
    /\bformula\s*:\s*/i,
    /\bcalculation\s*:\s*/i,
    /\btherefore\b/i,
    /\bhence\b\s*,?\s*(the|we|it)/i,
    /\bwe\s*know\s*that\b/i,
    /\baccording\s*to\b.*\blaw\b/i,
    /\bans\.?\s*[:\-\(]/i,
    /\bcorrect\s*option\s*is\b/i,
  ];

  // Check the last 40% of the document (solutions usually come after questions)
  const splitPoint = Math.floor(text.length * 0.6);
  const latterSection = text.slice(splitPoint);

  let matchCount = 0;
  for (const marker of solutionMarkers) {
    if (marker.test(text)) matchCount++;
    if (marker.test(latterSection)) matchCount++;
  }

  // If 2+ distinct solution markers found, OR 3+ in the latter section, it has solutions
  return matchCount >= 2;
}

function detectSectionsDeterministically(text: string): string[] {
  const sectionMarkers = [
    /^\s*(section\s+[a-z0-9])\s*[:\-\n]/im,
    /^\s*(part\s+[ivx0-9]+)\s*[:\-\n]/im,
    /^\s*(physics|chemistry|biology|mathematics|english|hindi|science|social\s+science)\s*[:\-\n]/im,
    /^\s*(unit\s+\d+)\s*[:\-\n]/im,
  ];
  const found = new Set<string>();
  for (const marker of sectionMarkers) {
    const matches = text.match(new RegExp(marker.source, 'gmi'));
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim().replace(/[:\-\n]/g, '').trim();
        const capitalized = cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        found.add(capitalized);
      }
    }
  }
  return Array.from(found);
}

function validateAndRepairQuestions(questions: any[]): any[] {
  const repaired = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Skip empty questions
    if (!q.question || q.question.trim().length < 5) continue;

    // Ensure unique sequential IDs
    const id = String(i + 1);

    // Validate type
    const validTypes = ['mcq', 'subjective', 'assertion_reason', 'case_study'];
    const type = validTypes.includes(q.type) ? q.type : 'subjective';

    // Validate marks
    const marks = (typeof q.marks === 'number' && q.marks > 0 && q.marks <= 20) ? q.marks : undefined;

    // Validate options (only for MCQ)
    let options = q.options;
    if (type !== 'mcq' && type !== 'assertion_reason') {
      options = undefined;
    } else if (options && !Array.isArray(options)) {
      options = undefined;
    } else if (options && options.length === 0) {
      options = undefined;
    }

    // Validate confidence
    const confidence = (typeof q.confidence === 'number' && q.confidence >= 0 && q.confidence <= 1)
      ? q.confidence : 0.7;

    repaired.push({
      ...q,
      id,
      type,
      marks,
      options,
      confidence,
    });
  }

  return repaired;
}

function estimateExpectedQuestionCount(text: string): number {
  const patterns = [
    /\bQ\.?\s*\d+/gi,
    /\b\d+\.\s+[A-Z]/g,  // "1. What..."
    /\b\d+\)\s+[A-Z]/g,  // "1) What..."
    /\b\(\d+\)/g,         // "(1)"
  ];
  let max = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) max = Math.max(max, matches.length);
  }
  return max;
}

/**
 * 3-PASS AI QUESTION EXTRACTION ENGINE
 *
 * Pass 1: Document Layout Detection — identify headers, instructions, sections, questions, solutions
 * Pass 2: Question Extraction — extract ONLY from question regions (never solutions)
 * Pass 3: Solution Matching — match solutions to questions, or generate model answers
 *
 * This prevents the "62 questions from solution steps" hallucination bug
 * and correctly detects embedded answer keys.
 *
 * NO chunking. NO truncation. Sends the full document text in one API call.
 */
export async function parseQuestionsWithGroq(text: string, answerKeyText?: string): Promise<ExtractionResult> {
  const systemPrompt = `You are a professional exam paper document analyst. You process exam papers in 3 strict passes.

=== PASS 1: DOCUMENT LAYOUT DETECTION ===
Identify and label these regions in the document:
- HEADER: school name, paper title, date, subject, class, exam name
- INSTRUCTIONS: general instructions like "read carefully", "marks are indicated", "attempt all questions"
- SECTIONS: Section A, Section B, Section C, Part I, Part II, etc.
- QUESTIONS: actual exam questions (including subparts like (a), (b), (i), (ii), and OR choices)
- SOLUTIONS: any block that starts with "Solutions", "Answer Key", "Marking Scheme", OR contains phrases like "Step 1", "Given data", "Using Ohm's law", "Formula:", "Calculation:", "Therefore", "Hence", "We know that", "According to"
- OR_SEPARATORS: where one question has internal alternatives (e.g., "OR" or "Choice" between two sub-questions)

=== PASS 2: QUESTION EXTRACTION (CRITICAL) ===
From the QUESTIONS regions ONLY, extract each question.

NEVER extract from SOLUTIONS regions. This is the most important rule.
- "Step 1: Calculate current" is NOT a question — it is a solution step.
- "Given data: R = 6 ohm" is NOT a question — it is solution data.
- "Therefore the fuse will not blow" is NOT a question — it is a conclusion.
- "Heat generated = 43200 J" is NOT a question — it is an answer.

If the document is NOT an exam paper (e.g., it's a manual, README, code file, or skill documentation), return an empty questions array with a warning explaining what the document appears to be.

For each question, detect:
- id: sequential string starting at "1"
- question: the question text (WITHOUT options, WITHOUT marks notation at the end, WITHOUT solution steps)
- type: "mcq" (has options A/B/C/D or 1/2/3/4) | "subjective" (short/long answer) | "assertion_reason" (Assertion + Reason format) | "case_study" (case-based paragraph with sub-questions)
- options: array of option texts (ONLY for MCQ). Do NOT include option labels like (A), (B), (C), (D) or a., b., c., d. inside the strings — extract ONLY the raw option text (e.g. "Hydrogen" instead of "A. Hydrogen").
- marks: number (look for [1], (2), 2M, 5 marks, [5] patterns — infer from section if missing)
- section: e.g. "Section A", "Section B", "Part I". Ensure section names are correctly mapped from the document headers.
- expectedAnswer: the solution/answer IF it exists in the document or answer key. Empty string if not found.
- confidence: 0.0 to 1.0 based on extraction clarity

=== PASS 3: SOLUTION MATCHING ===
If the document contains a SOLUTIONS region (either inline or as a separate answer key section):
- Match each solution to its question by question number
- Place the solution text in that question's "expectedAnswer" field
- Set "hasSolutions" to true
- Set "hasAnswerKey" to true

If NO solutions region exists in the document AND no separate answer key was provided:
- Set "hasSolutions" to false
- Set "hasAnswerKey" to false
- Do NOT generate model answers in this step — leave "expectedAnswer" empty

If a separate answer key text was provided:
- Match answer key entries to questions by number
- Set "hasSolutions" to true
- Set "hasAnswerKey" to true

=== HANDLING COMPLEX QUESTION TYPES ===
1. **Subparts**: If a question has subparts (e.g. (a), (b) or (i), (ii)), keep them together inside the single question text (e.g. formatted with clean bullet points or list style). Do NOT split them into separate top-level questions.
2. **Case Study / Passage-based Questions**: Group the reading passage/case study description and all its related sub-questions into a single question block of type "case_study". Set the question text to start with the passage, followed by the subparts.
3. **Match the Following**: Preserve the columns in the question text using line breaks and clear tab/space separation (e.g. Column I on the left, Column II on the right).
4. **Fill-in-the-blanks**: Keep blank lines (e.g. "_______" or "__________") intact in the question text.
5. **Diagram References**: If a question refers to a diagram or figure, preserve the reference text (e.g. "In the given figure, ...") in the question text.

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "questions": [
    {
      "id": "1",
      "question": "Question text here (without options or marks notation)",
      "type": "mcq" | "subjective" | "assertion_reason" | "case_study",
      "options": ["Option A text", "Option B text"],
      "marks": 5,
      "section": "Section A",
      "expectedAnswer": "Solution text if found, empty string if not",
      "confidence": 0.95
    }
  ],
  "total": 1,
  "warnings": [],
  "hasSolutions": true,
  "hasAnswerKey": true,
  "sections": ["Section A", "Section B"]
}

=== CRITICAL RULES ===
1. NEVER extract solution steps as questions.
2. NEVER hallucinate questions from equations, formulas, or calculation lines.
3. If you are unsure whether a block is a question or a solution, it is probably a solution — skip it.
4. Question numbers must be sequential (1, 2, 3, ...) even if the original paper uses different numbering.
5. Preserve mathematical notation in plain text (e.g., "I = V/R", "H = I2Rt").
6. The response must be valid JSON only. No markdown code blocks.`;

  const detectedSections = detectSectionsDeterministically(text);
  const sectionHint = detectedSections.length > 0
    ? `\n\n[DETECTED SECTIONS: ${detectedSections.join(', ')} — use these exact strings as the "section" field values for the extracted questions]`
    : '';

  const userContent = `Here is the Question Paper text (page breaks marked with \\f):\n${text}\n\n` +
    (answerKeyText && answerKeyText.trim()
      ? `Here is the corresponding Answer Key text:\n${answerKeyText}\n\n`
      : `No separate answer key was provided.\n\n`) +
    `Process this exam paper through your 3-pass pipeline and return the structured JSON.${sectionHint}`;

  const response = await createChatCompletionWithFallback('text', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const finishReason = response.choices[0]?.finish_reason;
  console.log(`[groq] Response: ${content.length} chars, finish_reason: ${finishReason}`);

  try {
    let cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

    // If still not pure JSON, try to extract the outermost { ... } block
    if (!cleaned.startsWith('{')) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(cleaned);

    const questions = validateAndRepairQuestions(parsed.questions || []);

    const deterministicHasSolutions = detectSolutionsDeterministically(text, answerKeyText);
    const warnings: string[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];

    if (!parsed.hasSolutions && !deterministicHasSolutions && !answerKeyText) {
      warnings.push('No answer key or solutions detected in the document. Reference answers will be dynamically generated during evaluation.');
    }

    const estimated = estimateExpectedQuestionCount(text);
    if (estimated > questions.length * 1.5) {
      warnings.push(`Only ${questions.length} questions extracted, but document appears to have ~${estimated}. Some questions may have been missed. Try a different model in Settings if quality is poor.`);
    }

    return {
      questions,
      total: questions.length,
      warnings,
      hasSolutions: Boolean(parsed.hasSolutions || deterministicHasSolutions || answerKeyText),
      hasAnswerKey: Boolean(parsed.hasAnswerKey || deterministicHasSolutions || answerKeyText),
      sections: Array.isArray(parsed.sections) ? parsed.sections : undefined,
    };
  } catch (err) {
    console.error('Failed to parse Groq response JSON.');
    console.error('Content length:', content.length);
    console.error('First 500 chars:', content.slice(0, 500));
    console.error('Last 500 chars:', content.slice(-500));
    throw new Error(`AI returned invalid JSON structure (length: ${content.length}). First 200 chars: ${content.slice(0, 200)}`);
  }
}

/**
 * Use Llama 3.3 70B to evaluate a student's answer against a reference solution.
 * Implements CBSE marking scheme with dual-pass verification.
 */
export async function evaluateAnswerWithGroq(
  question: string,
  studentAnswer: string,
  referenceAnswer?: string,
  maxMarks: number = 5,
  questionType: 'mcq' | 'subjective' | 'assertion_reason' = 'subjective'
): Promise<{
  marksAwarded: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
  refinedAnswer: string;
}> {
  const typeSpecific = questionType === 'mcq'
    ? 'This is an MCQ. Award full marks if the correct option is selected, zero otherwise.'
    : questionType === 'assertion_reason'
    ? 'This is an Assertion-Reason question. Both assertion and reason must be correct, and the reason must correctly explain the assertion for full marks.'
    : 'This is a subjective question. Apply CBSE step-wise marking: give partial credit for correct formula, correct steps, even if the final answer is wrong.';

  const prompt = `You are a strict CBSE board examiner. Evaluate the student's answer for the following question.

Question: "${question}"
Question Type: "${questionType}"
Max Marks: ${maxMarks}
${typeSpecific}

Reference Answer: "${referenceAnswer || 'No reference solution key provided. Generate the best model answer based on CBSE standards and verify it before grading.'}"

Student's Answer: "${studentAnswer}"

=== DUAL-PASS VERIFICATION ===

PASS 1 — Generate/Refine the ideal answer:
${referenceAnswer ? 'Use the provided reference answer as the base, but clean it up and ensure all calculation steps are correct.' : 'Generate a step-by-step model answer that would score full marks under CBSE marking scheme.'}

PASS 2 — Verify calculations:
Check every mathematical step in your ideal answer. Verify:
- Formula selection is correct
- Substitution of values is correct
- Arithmetic is correct
- Units are correct
- Final answer is correct
If any step is wrong, fix it before grading.

PASS 3 — Grade the student's answer:
Compare the student's answer to your verified ideal answer.
- Award marks for each correct step (CBSE step-wise marking)
- Award partial credit for correct formula even if calculation is wrong
- Award partial credit for correct method even if final answer is wrong
- Deduct marks for missing key concepts or wrong steps
- Be fair but strict — match real CBSE examiner behavior

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object:
{
  "marksAwarded": 0,
  "feedback": "Brief constructive feedback explaining the grade",
  "missingPoints": ["What key concepts or steps were omitted"],
  "strengths": ["What the student did well"],
  "refinedAnswer": "The verified, step-by-step model answer that scores full marks"
}

Output valid JSON only. No markdown.`;

  const response = await createChatCompletionWithFallback('text', {
    messages: [
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    let cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!cleaned.startsWith('{')) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }
    const parsed = JSON.parse(cleaned);
    const marksAwarded = Number(parsed.marksAwarded ?? 0);
    return {
      marksAwarded: Math.max(0, Math.min(maxMarks, marksAwarded)),
      feedback: parsed.feedback || '',
      missingPoints: Array.isArray(parsed.missingPoints) ? parsed.missingPoints : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      refinedAnswer: parsed.refinedAnswer || referenceAnswer || '',
    };
  } catch (err) {
    console.error('Failed to parse evaluation response JSON:', content.slice(0, 500));
    throw new Error('Groq returned invalid JSON for evaluation.');
  }
}
