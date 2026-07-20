// Runtime config. PUBLIC_ vars are exposed to the client bundle.
export const API_BASE =
  import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:58000';

export const DEFAULT_LANG = import.meta.env.PUBLIC_DEFAULT_LANG ?? 'ro';
