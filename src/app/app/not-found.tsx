import { StatusCard } from "../../components/status-card";

export default function NotFound() {
  return (
    <StatusCard
      code="404"
      title="This page is not in Munshi Pay."
      actions={
        <a className="button" href="/app">
          Back to the dashboard
        </a>
      }
    >
      The address may be mistyped, or the page may have moved.
    </StatusCard>
  );
}
