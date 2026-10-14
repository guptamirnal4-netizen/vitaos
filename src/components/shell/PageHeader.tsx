export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: string;
  title: string;
  subtitle: string;
  /** Page-level actions. They sit beside the title on wide screens and wrap below it on phones. */
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          <span aria-hidden="true">{icon}</span>
          {title}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </div>
  );
}
