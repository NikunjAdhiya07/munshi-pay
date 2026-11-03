export default function Loading() {
  return (
    <div aria-live="polite" aria-busy="true" className="loading">
      <p className="sr-only">Loading payroll data</p>
      <div className="skeleton title" />
      <div className="skeleton line" />
      <div className="money-row" aria-hidden="true">
        <div className="skeleton block" />
        <div className="skeleton block" />
        <div className="skeleton block" />
        <div className="skeleton block" />
      </div>
      <div className="skeleton panel-block" aria-hidden="true" />
    </div>
  );
}
