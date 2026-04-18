import Link from "next/link";

export default function MockLabelPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-text-primary">Label placeholder</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        In production this route (or a signed file URL) would serve a PDF generated from FedEx Ship API output. The
        mock store only stores{" "}
        <code className="mono text-xs text-accent-amber">label_url</code> pointing here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm font-semibold text-accent-blue transition-colors hover:text-accent-amber"
      >
        Back to home
      </Link>
    </div>
  );
}
