"use client";

import { useEffect } from "react";
import { StatusCard } from "../components/status-card";

export default function RootError({
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
    <StatusCard
      standalone
      code="Error"
      title="This page could not be loaded."
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
      Nothing on this page was shown. Try again, or return to sign in.
    </StatusCard>
  );
}
