import { describe, expect, test, type BenchResult } from 'vitest';
import { transformModule } from '../src/transform/transform-module';
import { createCollector } from '../src/collector/create-collector';

const report = (scenario: string, result: BenchResult) => {
  process.stdout.write(
    `${JSON.stringify({
      implementation: 'Oxc (raw transfer where supported)',
      scenario,
      transformationsPerSecond: Number((1000 / result.latency.mean).toFixed(2)),
      meanMs: Number(result.latency.mean.toFixed(5)),
      latencyRmePercent: Number(result.latency.rme.toFixed(2)),
    })}\n`,
  );
};

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
  for (const count of [1, 12, 60]) {
    test(`transforms ${count} direct icons`, async ({ bench }) => {
      const input =
        'import { Circle } from "lucide-react"; export const A=()=> <>' +
        '<Circle />'.repeat(count) +
        '</>;';
      expect(
        transformModule(input, id, () => {}).code.match(/iconId=/g),
      ).toHaveLength(count);
      const result = await bench('transformModule', () =>
        transformModule(input, id, () => {}),
      ).run({ time: 1500, warmupTime: 500 });
      report(`direct JSX (${count} usages)`, result);
    });
  }
  test('transforms one icon from a large import', async ({ bench }) => {
    const input =
      'import { Circle, ' +
      Array.from({ length: 500 }, (_, i) => `Icon${i}`).join(',') +
      ' } from "lucide-react"; export const A=()=> <Circle />;';
    expect(
      transformModule(input, id, () => {}).code.match(/iconId=/g),
    ).toHaveLength(1);
    const result = await bench('transformModule', () =>
      transformModule(input, id, () => {}),
    ).run({ time: 1500, warmupTime: 500 });
    report('one usage, 501 imported icons', result);
  });
  test('transforms repeated icons with the real collector', async ({
    bench,
  }) => {
    const run = () => {
      const collector = createCollector();
      const transformed = transformModule(code, id, (pack, exportName) => {
        collector.add(pack, exportName, { importer: id });
      });
      return { transformed, collector };
    };
    const { transformed, collector } = run();
    expect(transformed.code.match(/iconId=/g)).toHaveLength(240);
    expect(collector.toList()).toHaveLength(9);
    const result = await bench('transformModule with collector', run).run({
      time: 1500,
      warmupTime: 500,
    });
    report('direct JSX with collector (240 usages, 9 icons)', result);
  });
  test('passes through JSX without supported icon imports', async ({
    bench,
  }) => {
    const input = code.replaceAll('react-icons/', 'other-icons/');
    expect(transformModule(input, id, () => {})).toMatchObject({
      code: input,
      anyReplacements: false,
    });
    const result = await bench('transformModule', () => {
      transformModule(input, id, () => {});
    }).run({ time: 1000, warmupTime: 300 });
    report('non-icon JSX (240 elements)', result);
  });
  test('transforms a component with many icon usages', async ({ bench }) => {
    const transformed = transformModule(code, id, () => {});
    expect(transformed.anyReplacements).toBe(true);
    expect(transformed.code.match(/iconId=/g)).toHaveLength(240);
    const result = await bench('transformModule', () => {
      transformModule(code, id, () => {});
    }).run({ time: 1500, warmupTime: 500 });
    report('direct JSX (240 usages)', result);
  });

  test('transforms a component with many reference prop icon usages', async ({
    bench,
  }) => {
    const transformed = transformModule(referenceCode, id, () => {});
    expect(transformed.anyReplacements).toBe(true);
    expect(transformed.code.match(/iconId=/g)).toHaveLength(240);
    const result = await bench('transformModule', () => {
      transformModule(referenceCode, id, () => {});
    }).run({ time: 1500, warmupTime: 500 });
    report('reference props (240 usages)', result);
  });

  test('transforms a component with mixed component and reference icon usages', async ({
    bench,
  }) => {
    const transformed = transformModule(mixedCode, id, () => {});
    expect(transformed.anyReplacements).toBe(true);
    expect(transformed.code.match(/iconId=/g)).toHaveLength(240);
    const result = await bench('transformModule', () => {
      transformModule(mixedCode, id, () => {});
    }).run({ time: 1500, warmupTime: 500 });
    report('mixed (240 usages)', result);
  });
});
