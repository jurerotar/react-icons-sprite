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
  if (set === 0) {
    return '<BiAlarm /><BiAdjust className="x" /><BiAnchorAlt />';
  }
  if (set === 1) {
    return '<MdHome /><MdSettings /><MdFavorite className="fav" />';
  }
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

const referenceUsageBlock = Array.from({ length: 80 }, (_, i) => {
  const set = i % 3;
  if (set === 0) {
    return '<Button leadingIcon={BiAlarm} trailingIcon={BiAdjust} actionIcon={BiAnchorAlt} />';
  }
  if (set === 1) {
    return '<Button leadingIcon={MdHome} trailingIcon={MdSettings} actionIcon={MdFavorite} />';
  }
  return '<Button leadingIcon={FiActivity} trailingIcon={FiAirplay} actionIcon={FiAlertCircle} />';
}).join('\n          ');

const referenceCode = `
  import React from 'react';
  ${imports}

  const Button = (_props: {
    leadingIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    trailingIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    actionIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }) => null;

  export const BenchmarkComponent = () => (
    <div>
      ${referenceUsageBlock}
    </div>
  );
`;

const mixedUsageBlock = Array.from({ length: 80 }, (_, i) => {
  const set = i % 3;
  if (set === 0) {
    return '<Button leadingIcon={BiAlarm}><BiAdjust className="x" /><BiAnchorAlt /></Button>';
  }
  if (set === 1) {
    return '<Button leadingIcon={MdHome}><MdSettings /><MdFavorite className="fav" /></Button>';
  }
  return '<Button leadingIcon={FiActivity}><FiAirplay /><FiAlertCircle /></Button>';
}).join('\n          ');

const mixedCode = `
  import React from 'react';
  ${imports}

  const Button = (_props: {
    leadingIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    children?: React.ReactNode;
  }) => null;

  export const BenchmarkComponent = () => (
    <div>
      ${mixedUsageBlock}
    </div>
  );
`;

describe('transformModule benchmark', () => {
  bench('transforms a component with many icon usages', () => {
    transformModule(code, id, () => {});
  });

  bench('transforms a component with many reference prop icon usages', () => {
    transformModule(referenceCode, id, () => {});
  });

  bench(
    'transforms a component with mixed component and reference icon usages',
    () => {
      transformModule(mixedCode, id, () => {});
    },
  );
});
