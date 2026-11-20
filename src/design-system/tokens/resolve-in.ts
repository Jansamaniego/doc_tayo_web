interface Leaf {
  $value: string;
}

function isLeaf(node: unknown): node is Leaf {
  return typeof node === 'object' && node !== null && typeof (node as Leaf).$value === 'string';
}

/**
 * Looks up a token by its dotted path (`color.ink`, `palette.green.700`, `tv.color.bg`) in `root`
 * and follows `{references}` until it reaches a literal. Throws if the path or a reference does
 * not exist.
 */
export function resolveIn(root: object, path: string, seen: readonly string[] = []): string {
  if (seen.includes(path))
    throw new Error(`Circular token reference: ${[...seen, path].join(' -> ')}`);
  let node: unknown = root;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(key in node)) {
      throw new Error(`Unknown token: ${path}`);
    }
    node = (node as Record<string, unknown>)[key];
  }
  if (!isLeaf(node)) throw new Error(`Not a token value: ${path}`);
  const reference = /^\{([^}]+)\}$/.exec(node.$value);
  return reference?.[1] ? resolveIn(root, reference[1], [...seen, path]) : node.$value;
}
