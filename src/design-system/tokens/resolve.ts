import { resolveIn } from './resolve-in.ts';
import tokens from './tokens.json';

export { resolveIn };

export function resolveTokenValue(path: string): string {
  return resolveIn(tokens, path);
}

/** Like resolveTokenValue, but the result must be a `#rrggbb` colour. */
export function colorValue(path: string): string {
  const value = resolveTokenValue(path);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`Token ${path} is not a hex colour: ${value}`);
  return value;
}
