import { ApiHealth } from './components/ApiHealth';

export function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ACME Salary Management</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Scaffold — features land in the next commits.
          </p>
        </div>
        <ApiHealth />
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Roadmap
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
          <li>Employees: list, search, filter, sort, detail, salary history</li>
          <li>Give raise (transactional, audited)</li>
          <li>CSV bulk import with dry-run preview</li>
          <li>Analytics dashboard (headcount, distributions, top earners, pay bands)</li>
          <li>Multi-currency display via snapshot FX</li>
        </ul>
      </section>
    </main>
  );
}
