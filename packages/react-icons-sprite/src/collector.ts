import { createCollector } from './core';

// Shared singleton collector used by integrations that cannot share state easily
// (e.g., Webpack loader <-> plugin communication during a single build).
export const collector = createCollector();
