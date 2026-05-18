export function readLocalStorageJson<T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return fallback;
  }

  try {
    return parse(JSON.parse(storedValue) as unknown);
  } catch {
    return fallback;
  }
}

export function writeLocalStorageJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
