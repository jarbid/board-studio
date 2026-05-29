import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, de-duplicating conflicting Tailwind utilities. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
