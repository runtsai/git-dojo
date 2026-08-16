/**
 * Returns the title to display for a lesson card.
 *
 * The API derives titles from folder names, so they are almost always present.
 * When a lesson is added to the manifest without a title (empty string or
 * absent field), fall back to the lesson ID so the card is never blank.
 */
export function lessonDisplayTitle(
  title: string | null | undefined,
  id: string,
): string {
  const trimmed = (title ?? "").trim();
  return trimmed.length > 0 ? trimmed : id;
}
