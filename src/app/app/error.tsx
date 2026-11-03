"use client";

import { useEffect } from "react";
import { StatusCard } from "../../components/status-card";

export default function WorkspaceError({
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
      code="Error"
      title="This page could not be loaded."
      actions={
        <>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
          <a className="button quiet" href="/app">
            Back to the dashboard
          </a>
        </>
      }
    >
      The figures on this page were not shown. Your data was not changed. Try
      again, or go back.
    </StatusCard>
  );
}
