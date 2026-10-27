// Stand-in until each page is built. Every use is replaced by the task named in `task`.
export function PagePlaceholder({ title, task }: { title: string; task: number }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">This page is built in Task {task}.</p>
    </div>
  );
}
