"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { deleteLibraryBook, updateLibraryBook, uploadLibraryBook } from "@/app/library/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { bookFormats, getFileExtension, MAX_BOOK_SIZE, validateBookFile, type PublicLibraryBook } from "@/lib/library/books";
import { EmptyShelf, StorybookLibraryCard, UploadedBookCard } from "./book-card";
import { LibraryJourneyPanel } from "@/features/progression/room-completion-panel";
import { recordLibraryLocation } from "@/app/library/progression-actions";

type LibraryExperienceProps = { initialBooks: PublicLibraryBook[]; initialStorybookPage?: number; libraryCompleted?: boolean };
type Panel = { mode: "add" } | { mode: "edit"; book: PublicLibraryBook } | null;

export function LibraryExperience({ initialBooks, initialStorybookPage = 1, libraryCompleted = false }: LibraryExperienceProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [books, setBooks] = useState(initialBooks);
  const [panel, setPanel] = useState<Panel>(null);
  const [hasStoryProgress, setHasStoryProgress] = useState(initialStorybookPage > 1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const progress = JSON.parse(window.localStorage.getItem("maybe-storybook-page") ?? "null") as { page?: number } | null;
        if (progress && Number.isInteger(progress.page) && Number(progress.page) > 1 && Number(progress.page) <= 30) setHasStoryProgress(true);
      } catch {
        // Server progress remains authoritative when the local cache is unavailable.
      }
    });
    void recordLibraryLocation();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const removeBook = (book: PublicLibraryBook) => {
    if (deletingId || !window.confirm(`Remove “${book.title}” and its private file? This cannot be undone.`)) return;
    setDeletingId(book.id);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteLibraryBook(book.id);
      if (result.ok) setBooks((current) => current.filter((item) => item.id !== book.id));
      setNotice(result.message ?? result.error ?? null);
      setDeletingId(null);
    });
  };

  const jessicasShelf = books.filter((book) => book.shelf === "jessicas_shelf");
  const readTogether = books.filter((book) => book.shelf === "read_together");

  return (
    <main className="library-room">
      <CelestialBackground room="library" moonProgress={1} />
      <div className="library-lamp" aria-hidden="true" />
      <div className="library-dust" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      <header className="library-toolbar">
        <Link href="/?view=world">← Back to World</Link>
        <button type="button" onClick={() => setPanel({ mode: "add" })}>Add a Book</button>
      </header>
      <motion.header className="library-hero" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p>A private reading room</p>
        <h1>The Library</h1>
        <span>Books placed here stay inside this approved little world.</span>
      </motion.header>
      {notice ? <p className="library-notice" role="status">{notice}</p> : null}
      <section className="library-shelf-section">
        <header><p>Permanent collection</p><h2>Our Story</h2></header>
        <div className="library-shelf"><StorybookLibraryCard hasProgress={hasStoryProgress} /></div>
      </section>
      <LibraryShelf title="Jessica’s Shelf" eyebrow="Private shelf" books={jessicasShelf} emptyMessage="A quiet place for the stories, books and worlds you love." deletingId={deletingId} onEdit={(book) => setPanel({ mode: "edit", book })} onDelete={removeBook} />
      <LibraryShelf title="Read Together" eyebrow="Shared shelf" books={readTogether} emptyMessage="Books we may choose, start and discover together." deletingId={deletingId} onEdit={(book) => setPanel({ mode: "edit", book })} onDelete={removeBook} />
      <LibraryJourneyPanel alreadyCompleted={libraryCompleted} />
      <AnimatePresence>{panel ? <BookPanel panel={panel} onClose={() => setPanel(null)} onSaved={(book, message) => {
        setBooks((current) => panel.mode === "add" ? [book, ...current] : current.map((item) => item.id === book.id ? book : item));
        setNotice(message);
        setPanel(null);
      }} /> : null}</AnimatePresence>
    </main>
  );
}

function LibraryShelf({ title, eyebrow, books, emptyMessage, deletingId, onEdit, onDelete }: {
  title: string;
  eyebrow: string;
  books: PublicLibraryBook[];
  emptyMessage: string;
  deletingId: string | null;
  onEdit: (book: PublicLibraryBook) => void;
  onDelete: (book: PublicLibraryBook) => void;
}) {
  return (
    <section className="library-shelf-section">
      <header><p>{eyebrow}</p><h2>{title}</h2></header>
      <div className="library-shelf">
        {books.length ? books.map((book) => <UploadedBookCard key={book.id} book={book} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === book.id} />) : <EmptyShelf title={title} message={emptyMessage} />}
      </div>
    </section>
  );
}

function BookPanel({ panel, onClose, onSaved }: { panel: Exclude<Panel, null>; onClose: () => void; onSaved: (book: PublicLibraryBook, message: string) => void }) {
  const reduceMotion = Boolean(useReducedMotion());
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileSummary, setFileSummary] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setProgress(12);
    const formData = new FormData(event.currentTarget);
    const result = panel.mode === "add" ? await uploadLibraryBook(formData) : await updateLibraryBook(formData);
    setProgress(result.ok ? 100 : 0);
    submittingRef.current = false;
    setSubmitting(false);
    if (result.ok && result.book) onSaved(result.book, result.message ?? "Library updated.");
    else setError(result.error ?? "The Library could not be updated.");
  };

  return (
    <motion.div className="library-panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!submitting) onClose(); }}>
      <motion.aside className="library-book-panel" role="dialog" aria-modal="true" aria-labelledby="book-panel-title" initial={reduceMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={reduceMotion ? { opacity: 0 } : { x: "100%" }} onClick={(event) => event.stopPropagation()}>
        <header><div><p>{panel.mode === "add" ? "Private upload" : "Your upload"}</p><h2 id="book-panel-title">{panel.mode === "add" ? "Add a Book" : "Edit Book"}</h2></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Close">×</button></header>
        <form onSubmit={submit}>
          {panel.mode === "edit" ? <input type="hidden" name="id" value={panel.book.id} /> : (
            <label className="library-file-field">
              <span>Book file</span>
              <input name="file" type="file" accept=".pdf,.epub,.txt,.docx,application/pdf,application/epub+zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) { setFileSummary(null); return; }
                const extension = getFileExtension(file.name);
                const clientError = file.size === 0 ? "Choose a non-empty file." : file.size > MAX_BOOK_SIZE ? "Books must be 25 MB or smaller." : !extension || file.type !== bookFormats[extension].mime ? "Use a matching PDF, EPUB, TXT, or DOCX file." : null;
                if (clientError) { setError(clientError); setFileSummary(null); return; }
                const validated = await validateBookFile(file);
                if (!validated.ok) { setError(validated.error); setFileSummary(null); return; }
                setError(null);
                setFileSummary(`${file.name} · ${bookFormats[validated.extension].label} · ${formatBytes(file.size)}`);
              }} />
              <small>PDF, EPUB, TXT or DOCX · Maximum 25 MB</small>
              {fileSummary ? <strong>{fileSummary}</strong> : null}
            </label>
          )}
          <label><span>Title</span><input name="title" defaultValue={panel.mode === "edit" ? panel.book.title : ""} required maxLength={160} /></label>
          <label><span>Author</span><input name="author" defaultValue={panel.mode === "edit" ? panel.book.author : ""} required maxLength={160} /></label>
          <label><span>Description <small>Optional</small></span><textarea name="description" defaultValue={panel.mode === "edit" ? panel.book.description : ""} maxLength={2000} rows={3} /></label>
          <label><span>Personal note <small>Optional</small></span><textarea name="personal_note" defaultValue={panel.mode === "edit" ? panel.book.personal_note : ""} maxLength={2000} rows={3} /></label>
          <label><span>Shelf</span><select name="shelf" defaultValue={panel.mode === "edit" ? panel.book.shelf : "jessicas_shelf"} required><option value="jessicas_shelf">Jessica’s Shelf</option><option value="read_together">Read Together</option></select></label>
          <label><span>Reading status</span><select name="reading_status" defaultValue={panel.mode === "edit" ? panel.book.reading_status : "not_started"}><option value="not_started">Not started</option><option value="reading">Reading</option><option value="completed">Completed</option></select></label>
          <label className="library-toggle"><input name="allow_download" type="checkbox" defaultChecked={panel.mode === "edit" ? panel.book.allow_download : false} /><span>Allow another approved member to download this file</span></label>
          {error ? <p className="library-form-error" role="alert">{error}</p> : null}
          {submitting ? <div className="library-upload-progress" aria-label="Upload in progress"><span style={{ width: `${Math.max(progress, 58)}%` }} /></div> : null}
          <div className="library-panel-actions"><button type="button" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? panel.mode === "add" ? "Uploading…" : "Saving…" : panel.mode === "add" ? "Add to Library" : "Save changes"}</button></div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
