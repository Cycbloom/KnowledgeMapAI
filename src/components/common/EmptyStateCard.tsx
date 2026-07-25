import { EmptyState, type EmptyStateProps } from './EmptyState';

export type EmptyStateCardProps = EmptyStateProps;

export function EmptyStateCard(props: EmptyStateCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-500">
      <EmptyState {...props} />
    </div>
  );
}
