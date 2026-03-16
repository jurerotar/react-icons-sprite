import { transformModule } from '../transform/transform-module';
import { collector } from '../collector';
import type { LoaderDefinitionFunction } from 'webpack';

const reactIconsSpriteLoader: LoaderDefinitionFunction = async function (
  this,
  source,
): Promise<string> {
  if (this.mode === 'development') {
    return source;
  }

  const id = this.resourcePath;

  try {
    if (!/\.(mjs|cjs|js|jsx|ts|tsx)$/i.test(id)) {
      return source;
    }

    const { code, anyReplacements } = transformModule(
      String(source),
      id,
      (pack, exportName) => {
        collector.add(pack, exportName);
      },
    );

    if (!anyReplacements) {
      return source;
    }

    return code;
  } catch (err) {
    this.emitWarning(
      new Error(
        `[react-icons-sprite] Failed to transform ${id}: ${String(err)}`,
      ),
    );
    return source;
  }
};

export default reactIconsSpriteLoader;
