import { afterEach, expect, test, vi } from 'vitest';
import { collector } from '../src/collector';
import loader from '../src/webpack/loader';
import type { ReactIconsSpritePluginOptions } from '../src/plugin-options';

afterEach(() => vi.restoreAllMocks());

const source = `import { Alarm } from 'lucide-react';
export const Example = () => <Alarm />;`;

test.each([undefined, /^lucide-react$/, [/^lucide-react$/]])(
  'passes configured exclusions from loader options to the transform: %s',
  async (exclude) => {
    const add = vi.spyOn(collector, 'add').mockImplementation(() => {});
    const emitWarning = vi.fn();
    const getOptions = vi.fn(
      (): ReactIconsSpritePluginOptions => ({ exclude }),
    );
    const context = {
      mode: 'production',
      resourcePath: '/project/src/icons.tsx',
      getOptions,
      emitWarning,
    } as unknown as ThisParameterType<typeof loader>;
    const result = await loader.call(context, source);
    expect(getOptions).toHaveBeenCalledOnce();
    expect(emitWarning).not.toHaveBeenCalled();
    if (exclude) {
      expect(result).toBe(source);
      expect(add).not.toHaveBeenCalled();
    } else {
      expect(result).toContain('iconId="ri-lucide-react-Alarm"');
      expect(add).toHaveBeenCalledWith('lucide-react', 'Alarm', {
        importer: context.resourcePath,
      });
    }
  },
);
