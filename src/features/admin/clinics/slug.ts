const MAX_LENGTH = 60;
const PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The API's rule: lower-case letters and digits in groups separated by single hyphens, at most 60. */
export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_LENGTH && PATTERN.test(slug);
}

/** A starting point for the web address name, from the clinic's name. The admin can edit it. */
export function suggestSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
}
