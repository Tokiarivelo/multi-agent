'use client';

interface AvatarPerson {
  name: string;
  email?: string;
}

interface AvatarGroupProps {
  people: AvatarPerson[];
  max?: number;
}

const COLORS = [
  'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  'bg-green-500/20 text-green-600 dark:text-green-400',
  'bg-amber-500/20 text-amber-600 dark:text-amber-400',
];

function initials(person: AvatarPerson): string {
  const parts = person.name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]?.length) return parts[0][0].toUpperCase();
  return person.email?.[0]?.toUpperCase() ?? '?';
}

export function AvatarGroup({ people, max = 3 }: AvatarGroupProps) {
  if (!people.length) return null;

  const visible = people.slice(0, max);
  const overflow = people.length - max;
  const overflowNames = people.slice(max).map((p) => p.name || p.email || '').join(', ');

  return (
    <div className="flex -space-x-2 items-center">
      {visible.map((person, i) => (
        <div
          key={i}
          title={`${person.name}${person.email ? ` (${person.email})` : ''}`}
          className={`w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[11px] font-semibold cursor-default select-none ${COLORS[i % COLORS.length]}`}
        >
          {initials(person)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={overflowNames}
          className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground cursor-default select-none"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
