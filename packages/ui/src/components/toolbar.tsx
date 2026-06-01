import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Horizontal toolbar shell for the editor (groups of buttons, separators). */
export const Toolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        'flex h-12 items-center gap-1 border-b border-border bg-card px-2 text-card-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Toolbar.displayName = 'Toolbar';

export const ToolbarSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mx-1 h-6 w-px bg-border', className)} {...props} />
  ),
);
ToolbarSeparator.displayName = 'ToolbarSeparator';
