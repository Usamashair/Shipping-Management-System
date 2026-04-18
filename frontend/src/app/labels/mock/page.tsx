import Link from "next/link";

export default function MockLabelPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Label placeholder</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        In production this route (or a signed file URL) would serve a PDF generated from FedEx
        Ship API output. The mock store only stores <code className="font-mono text-xs">label_url</code>{" "}
        pointing here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm font-medium text-sky-600 dark:text-sky-400"
      >
        Back to home
      </Link>
    </div>
  );
}
