"use client";

import { useEffect, useRef, useState } from "react";
import { saveCustomQuestionGardenQuestion } from "@/app/question-garden/actions";
import { QUESTION_GARDEN_CATEGORIES, type GardenQuestionPreview, type QuestionGardenCategory } from "@/lib/question-garden/contracts";

export function PlantQuestionPanel({ initial, onClose, onSaved }: { initial?: GardenQuestionPreview | null; onClose: () => void; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [category, setCategory] = useState<QuestionGardenCategory>(initial?.category ?? "How We Began");
  const [responseType, setResponseType] = useState<"long_text" | "short_text" | "choice">(initial?.responseType ?? "long_text");
  const [options, setOptions] = useState(initial?.options?.join("\n") ?? "");
  const [note, setNote] = useState(initial?.personalNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const controls = panel.current?.querySelectorAll<HTMLElement>("button,input,textarea,select");
    controls?.[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);
  const save = async () => {
    if (pending) return;
    setPending(true); setError(null);
    const result = await saveCustomQuestionGardenQuestion({
      id: initial?.id ?? null, prompt, category, responseType,
      options: responseType === "choice" ? options.split("\n").map((item) => item.trim()).filter(Boolean) : null,
      personalNote: note,
    });
    if (result.ok) onSaved();
    else setError(result.reason === "duplicate" ? "That question is already growing here." : result.reason === "frozen" ? "This question is frozen because an answer already exists." : "This question could not be planted just now.");
    setPending(false);
  };
  return <div className="garden-question-overlay" role="presentation"><section ref={panel} className="garden-question-panel plant-question-panel" role="dialog" aria-modal="true" aria-labelledby="plant-title">
    <header><p>A question from you</p><h2 id="plant-title">{initial ? "Tend this question" : "Plant a question"}</h2></header>
    <label>Question<textarea value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} /></label>
    <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as QuestionGardenCategory)}>{QUESTION_GARDEN_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>Answer format<select value={responseType} onChange={(event) => setResponseType(event.target.value as typeof responseType)}><option value="long_text">Long text</option><option value="short_text">Short text</option><option value="choice">Choice</option></select></label>
    {responseType === "choice" ? <label>Choice options, one per line<textarea value={options} onChange={(event) => setOptions(event.target.value)} /></label> : null}
    <label>Personal note, optional<textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
    {error ? <p role="alert">{error}</p> : null}<div className="garden-answer-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={pending} aria-busy={pending} onClick={() => void save()}>{pending ? "Planting…" : initial ? "Save question" : "Plant this question"}</button></div>
  </section></div>;
}
