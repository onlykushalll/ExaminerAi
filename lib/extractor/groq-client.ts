import OpenAI from 'openai';
import type { ExtractionResult } from './types';

// Initialize OpenAI client pointing to Groq's endpoint
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set.');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
};

/**
 * Checks if Groq AI parsing is configured and enabled.
 */
export function isGroqEnabled(): boolean {
  return typeof process.env.GROQ_API_KEY === 'string' && process.env.GROQ_API_KEY.length > 0;
}

/**
 * Use Llama 3.2 Vision to extract clean text from a base64 page image.
 */
export async function ocrPageWithGroqVision(base64Image: string): Promise<string> {
  const client = getGroqClient();

  // Strip prefix if present (e.g. data:image/jpeg;base64,)
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  const response = await client.chat.completions.create({
    model: 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Perform OCR on this exam paper page image. Extract and output all readable text exactly as printed. Do not summarize or add conversational filler. If there are math equations, write them in plain text or standard math symbols.',
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
    max_tokens: 2048,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Use Llama 3.3 70B to parse raw paper text into structured questions and solutions.
 */
export async function parseQuestionsWithGroq(text: string, answerKeyText?: string): Promise<ExtractionResult> {
  const client = getGroqClient();

  const systemPrompt = `You are an elite, professional exam paper parser designed to handle any document format, question numbering scheme, layout, and structure. Your job is to extract all questions, their marks, options (for multiple-choice questions), and solutions/answers from the raw text.

Identify the question type for each question:
- 'mcq' (if it has options)
- 'assertion_reason' (if it consists of Assertion and Reason statements)
- 'subjective' (for standard short/long answer questions, including case studies and group questions)

CRITICAL RULES FOR EXTRACTION IMMUNITY:
1. **No Hallucinations**: Extract only what is present in the text. Do not invent questions.
2. **Scrambled MCQ Options**: In some multi-column PDFs, options (e.g., a, b, c, d) might be extracted immediately *before* the question statement or number. You must carefully associate these options with their respective questions.
3. **Internal Choice (OR) Questions**: Do not treat OR questions as two separate questions or skip them. Combine them into a single question using an "OR" divider (e.g. "[First Question] ... OR ... [Second Question]") so that both choices are preserved for practice.
4. **Sub-parts & Numbering**: Questions can have any number formats (e.g. "1.", "Q1", "Question 1:", "30)"). Keep them sequential. If a question has sub-parts like (a), (b), (c) or (i), (ii), (iii), group them together inside the single question statement so the overall question structure is clear and readable.
5. **Extract All Sections**: Ensure no sections (e.g. Section A, Section B, Section C, Section D, Section E) or subjects (e.g. Biology, Chemistry, Physics) are skipped, truncated, or cut off. Parse the entire document from start to finish.
6. **Embedded Answer Keys & Solutions**:
   - The input document may contain an **Answer Key, Solutions, Marking Scheme, Answers, or Hints** section appended at the end of the text (e.g., on later pages of the PDF).
   - You must scan the entire document text to find this.
   - If an answer key or solution list is present, **DO NOT** generate your own solutions. Extract the exact answers and step-by-step solutions from the document's answer key section, and map them to their corresponding question under the "expectedAnswer" field.
   - If (and only if) no answer key/solution is found in the text or separate inputs, generate a highly accurate, CBSE-aligned step-by-step model solution/answer.
7. **Marks Extraction**: Marks are usually written in formats like [1], (2), 5 marks, or 3M. Extract the numeric marks value. If marks are missing, infer a sensible number based on complexity (MCQs = 1 mark, short subjective = 2-3 marks, long subjective/case studies = 4-5 marks).

The output must be a valid JSON object matching the following structure:
{
  "questions": [
    {
      "id": "1", // sequential starting at 1
      "question": "Question text here (including any subparts and OR choices, but excluding marks notation)",
      "type": "mcq" | "subjective" | "assertion_reason",
      "options": ["Option A text", "Option B text", ...], // only for MCQ
      "marks": 5, // numeric value
      "section": "Section A", // section or subject group name
      "expectedAnswer": "Exact solution / answer key / model answer here",
      "confidence": 0.95 // extraction confidence score (0.0 to 1.0)
    }
  ],
  "total": 1,
  "warnings": []
}

Ensure the response is valid JSON only. Do not wrap in markdown code blocks.`;

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Here is the Question Paper text:\n${text}\n\n` +
                 (answerKeyText ? `Here is the corresponding Answer Key text:\n${answerKeyText}\n\n` : '') +
                 `Please parse this exam paper and return the structured JSON containing all questions and expected answers.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content || '{}';
  
  try {
    const parsed = JSON.parse(content);
    return {
      questions: parsed.questions || [],
      total: parsed.total || (parsed.questions?.length ?? 0),
      warnings: parsed.warnings || [],
    };
  } catch (err) {
    console.error('Failed to parse Groq response JSON:', content);
    throw new Error('Groq returned invalid JSON structure.');
  }
}

/**
 * Use Llama 3.3 70B to evaluate a student's answer against a reference solution.
 */
export async function evaluateAnswerWithGroq(
  question: string,
  studentAnswer: string,
  referenceAnswer?: string,
  maxMarks: number = 5,
  questionType: 'mcq' | 'subjective' = 'subjective'
): Promise<{
  marksAwarded: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
  refinedAnswer: string;
}> {
  const client = getGroqClient();

  const prompt = `You are a strict examiner for academic papers (following the CBSE board marking scheme). Evaluate the student's answer for the following question.

Question: "${question}"
Question Type: "${questionType}"
Max Marks: ${maxMarks}
Reference Answer: "${referenceAnswer || 'No reference solution key provided. Evaluate based on standard scientific accuracy and syllabus benchmarks.'}"
Student's Answer: "${studentAnswer}"

Evaluate the student's answer and produce a JSON object with:
1. "marksAwarded": number (0 to ${maxMarks}, be fair but strict. Match CBSE marking scheme: partial credit for correct steps/formula even if final answer is wrong)
2. "feedback": string (brief, constructive feedback explaining the grade)
3. "missingPoints": array of strings (what key concepts or steps did the student omit?)
4. "strengths": array of strings (what did the student do well?)
5. "refinedAnswer": string (The absolute best, standard model answer that scores full marks. If a Reference Answer was provided, use that as the base, but clean up and refine it. If no Reference Answer was provided, generate the best model solution step-by-step).

Verify your output twice internally before responding:
1. Check if the calculation steps in your "refinedAnswer" are mathematically correct.
2. Confirm the marks awarded match the level of correctness of the student's answer.

Output valid JSON only matching the schema.`;

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      marksAwarded: Number(parsed.marksAwarded ?? 0),
      feedback: parsed.feedback || '',
      missingPoints: parsed.missingPoints || [],
      strengths: parsed.strengths || [],
      refinedAnswer: parsed.refinedAnswer || '',
    };
  } catch (err) {
    console.error('Failed to parse evaluation response JSON:', content);
    throw new Error('Groq returned invalid JSON for evaluation.');
  }
}
