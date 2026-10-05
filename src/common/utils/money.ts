/**
 * Formats a whole-shilling amount for display.
 *
 * @param amountInKes - Integer Kenyan shillings.
 * @returns A string such as "KES 1,500".
 */
export function formatAmountInKes(amountInKes: number): string {
  const formatted = new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(amountInKes);

  return `KES ${formatted}`;
}
