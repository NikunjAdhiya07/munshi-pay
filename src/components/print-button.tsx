"use client";

/**
 * Opens the browser print dialog. The same dialog saves a PDF, which is how a
 * slip is downloaded today. There is no server-made PDF yet.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
