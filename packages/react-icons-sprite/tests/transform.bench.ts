import { bench, describe } from 'vitest';
import { transformModule } from '../src/transform/transform-module';

const id = 'BenchmarkComponent.tsx';

const imports = [
  "import { BiAlarm, BiAdjust, BiAnchorAlt } from 'react-icons/bi';",
  "import { MdHome, MdSettings, MdFavorite } from 'react-icons/md';",
  "import { FiActivity, FiAirplay, FiAlertCircle } from 'react-icons/fi';",
].join('\n');

const usageBlock = Array.from({ length: 80 }, (_, i) => {
  const set = i % 3;
  if (set === 0) return '<BiAlarm /><BiAdjust className="x" /><BiAnchorAlt />';
  if (set === 1)
    return '<MdHome /><MdSettings /><MdFavorite className="fav" />';
  return '<FiActivity /><FiAirplay /><FiAlertCircle />';
}).join('\n          ');

const code = `
  import React from 'react';
  ${imports}

  export const BenchmarkComponent = () => (
    <div>
      ${usageBlock}
    </div>
  );
`;

describe('transformModule benchmark (OXC parser)', () => {
  bench('transforms a component with many icon usages', () => {
    transformModule(code, id, () => {});
  });
});
