import createClient from 'openapi-fetch';

import { API_BASE } from '../config/env';
import type { paths } from '../types/api';

// Typed fetch client bound to the backend OpenAPI (src/types/api.d.ts, generated).
export const api = createClient<paths>({ baseUrl: API_BASE });
