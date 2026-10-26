import {
  parseSync,
  rawTransferSupported,
  type ParserOptions,
  type Program,
} from 'oxc-parser';

export const createModuleParser = (preferRawTransfer = true) => {
  // Raw transfer avoids JSON serialization. Oxc limits it to supported runtimes
  // and architectures; other platforms use its standard ESTree parser.
  const options: ParserOptions & { experimentalRawTransfer: boolean } = {
    sourceType: 'unambiguous',
    lang: 'tsx',
    astType: 'ts',
    preserveParens: false,
    showSemanticErrors: true,
    experimentalRawTransfer: preferRawTransfer && rawTransferSupported(),
  };
  return (id: string, code: string): Program | null => {
    const result = parseSync(id, code, options);
    return result.errors.length ? null : result.program;
  };
};
