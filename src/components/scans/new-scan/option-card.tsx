import { CircleCheck, type LucideIcon } from 'lucide-react';

/**
 * A big selectable card, built on a real radio button. Arrow keys and screen readers work
 * without extra code, and the check mark means the choice isn't shown by colour alone.
 */
export function OptionCard({
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  detail?: string;
}) {
  return (
    <label className="group border-border hover:border-primary/50 has-[input:checked]:border-primary has-[input:checked]:bg-primary/5 has-[input:focus-visible]:ring-ring relative flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-5 transition has-[input:focus-visible]:ring-2">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <CircleCheck
        aria-hidden
        className="text-primary absolute top-4 right-4 hidden size-5 group-has-[input:checked]:block"
      />
      <Icon className="text-primary size-8" aria-hidden />
      <span className="text-lg font-semibold">{title}</span>
      <span className="text-muted-foreground text-sm">{description}</span>
      {detail && <span className="text-muted-foreground font-mono text-xs">{detail}</span>}
    </label>
  );
}
