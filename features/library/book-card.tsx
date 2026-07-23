"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { PublicLibraryBook } from "@/lib/library/books";

type UploadedBookCardProps = {
  book: PublicLibraryBook;
  onEdit: (book: PublicLibraryBook) => void;
  onDelete: (book: PublicLibraryBook) => void;
  deleting: boolean;
};

export function UploadedBookCard({ book, onEdit, onDelete, deleting }: UploadedBookCardProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const previewable = book.file_extension === "pdf" || book.file_extension === "txt";
  const canDownload = book.is_uploader || book.allow_download;

  return (
    <motion.article className="library-book-card" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={reduceMotion ? undefined : { y: -3 }}>
      <div className={`library-css-cover library-cover-${book.file_extension}`} aria-hidden="true"><span>{book.title.slice(0, 1)}</span><small>{book.file_extension.toUpperCase()}</small></div>
      <div className="library-book-copy">
        <div className="library-book-meta"><span>{book.file_extension.toUpperCase()} · {formatBytes(book.size_bytes)}</span><span>{book.is_uploader ? "Uploaded by you" : "Private member upload"}</span></div>
        <h3>{book.title}</h3>
        <p className="library-book-author">by {book.author}</p>
        {book.description ? <p>{book.description}</p> : null}
        {book.personal_note ? <blockquote>{book.personal_note}</blockquote> : null}
        <span className="library-reading-status">{readingStatusLabel(book.reading_status)}</span>
        <div className="library-card-actions">
          {previewable ? <a className="library-action-link" href={`/library/books/${book.id}/access?mode=open`} target="_blank" rel="noreferrer">Open</a> : <span className="library-unavailable">Preview unavailable</span>}
          {canDownload ? <a className="library-action-link" href={`/library/books/${book.id}/access?mode=download`}>Download</a> : null}
          {book.is_uploader ? <button type="button" onClick={() => onEdit(book)}>Edit</button> : null}
          {book.is_uploader ? <button type="button" className="library-delete-action" onClick={() => onDelete(book)} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button> : null}
        </div>
      </div>
    </motion.article>
  );
}

export function StorybookLibraryCard({ hasProgress }: { hasProgress: boolean }) {
  return (
    <article className="library-book-card library-featured-book">
      <div className="library-css-cover library-cover-story" aria-hidden="true"><span>✦</span><small>Private Storybook</small></div>
      <div className="library-book-copy">
        <div className="library-book-meta"><span>Private Storybook</span><span>Built into this world</span></div>
        <h3>The Beginning of Maybe</h3>
        <p>A small book about an unexpected screenshot and everything that began after it.</p>
        <blockquote>The first book placed in this little library.</blockquote>
        <div className="library-card-actions">
          <Link className="library-action-link" href="/story">{hasProgress ? "Continue Reading" : "Open Storybook"}</Link>
        </div>
      </div>
    </article>
  );
}

export function EmptyShelf({ title, message }: { title: string; message: string }) {
  return <div className="library-empty-shelf"><span aria-hidden="true">⌁</span><h3>{title}</h3><p>{message}</p></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readingStatusLabel(status: PublicLibraryBook["reading_status"]) {
  if (status === "reading") return "Currently reading";
  if (status === "completed") return "Completed";
  return "Not started";
}
