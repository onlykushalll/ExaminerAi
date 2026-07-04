import { SavedExamResult } from "@/lib/api-types";

const LATEST_RESULT_KEY = "examiner-ai-latest-result";
const RESULT_HISTORY_KEY = "examiner-ai-result-history";
const MAX_SAVED_RESULTS = 8;

export function saveExamResult(result: SavedExamResult) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LATEST_RESULT_KEY, JSON.stringify(result));

  const history = getSavedExamResults();
  const nextHistory = [result, ...history.filter((item) => item.evaluation.evaluationId !== result.evaluation.evaluationId)].slice(
    0,
    MAX_SAVED_RESULTS
  );
  window.localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(nextHistory));
}

export function getLatestExamResult() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LATEST_RESULT_KEY);
    return raw ? (JSON.parse(raw) as SavedExamResult) : null;
  } catch {
    return null;
  }
}

export function getSavedExamResults() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RESULT_HISTORY_KEY);
    return raw ? ((JSON.parse(raw) as SavedExamResult[]) ?? []) : [];
  } catch {
    return [];
  }
}
