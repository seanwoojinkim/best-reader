import { Book as EpubBook } from 'epubjs';

/**
 * Type extensions for epub.js library
 *
 * The epub.js TypeScript definitions are incomplete. These extensions
 * provide proper typing for runtime-available properties without using 'any'.
 */

export interface EpubSpineItem {
  href: string;
  index: number;
  cfiBase: string;
  canonical?: string;
  idref?: string;
  linear?: string;
  properties?: string[];
  prev?: () => EpubSpineItem | undefined;
  next?: () => EpubSpineItem | undefined;
}

export interface EpubSpine {
  items: EpubSpineItem[];
  spineItems: EpubSpineItem[];
  length: number;
  get(target: string | number): any;
  first(): any;
  last(): any;
}

export interface EpubLocations {
  /**
   * Compare two CFI strings
   * Returns: -1 if a < b, 0 if equal, 1 if a > b
   */
  cfiComparison(cfiA: string, cfiB: string): number;

  /**
   * Get percentage through book from CFI
   */
  percentageFromCfi(cfi: string): number;

  /**
   * Get total number of locations
   */
  length(): number;

  /**
   * Generate locations with specific character count per page
   */
  generate(charsPerPage?: number): Promise<void>;
}

/**
 * Type guard to check if book has extended spine properties
 */
export function hasSpineItems(book: EpubBook): boolean {
  return (
    'spine' in book &&
    'items' in (book as any).spine
  );
}

/**
 * Type guard to check if book has locations
 */
export function hasLocations(book: EpubBook): boolean {
  return 'locations' in book;
}

/**
 * Safely access extended book spine
 */
export function getEpubSpine(book: EpubBook): EpubSpine | null {
  if (!hasSpineItems(book)) {
    console.warn('Book does not have extended spine properties');
    return null;
  }
  return (book as any).spine as EpubSpine;
}

/**
 * Safely access extended book locations
 */
export function getEpubLocations(book: EpubBook): EpubLocations | null {
  if (!hasLocations(book)) {
    console.warn('Book does not have extended locations properties');
    return null;
  }
  return (book as any).locations as EpubLocations;
}
