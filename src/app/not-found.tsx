import { StatusCard } from "../components/status-card";

export default function NotFound() {
  return (
    <StatusCard
      standalone
      code="404"
      title="This page is not in Munshi Pay."
      actions={
        <a className="button" href="/">
          Back to sign in
        </a>
      }
    >
      The address may be mistyped, or the page may have moved.
    </StatusCard>
  );
}
