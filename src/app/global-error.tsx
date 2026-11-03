"use client";

import { useEffect } from "react";
import { StatusCard } from "../components/status-card";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    if (error.digest) console.error(error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <StatusCard
          standalone
          code="Error"
          title="Munshi Pay could not be loaded."
          actions={
            <>
              <button type="button" onClick={() => retry()}>
                Try again
              </button>
              <a className="button quiet" href="/">
                Back to sign in
              </a>
            </>
          }
        >
          Nothing was shown. Try again, or return to sign in.
        </StatusCard>
      </body>
    </html>
  );
}
