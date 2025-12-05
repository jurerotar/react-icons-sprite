import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactIconsSpriteIcon } from '../src/icon';
import { PLACEHOLDER } from '../src/core';

describe('ReactIconsSpriteIcon component', () => {
  it('renders svg with default attributes and composed href', () => {
    const html = renderToStaticMarkup(
      <ReactIconsSpriteIcon
        iconId="ri-BiAlarm"
        className="x"
        aria-label="bell"
      />,
    );

    expect(html).toContain('<svg');
    expect(html).toContain('height="1em"');
    expect(html).toContain('width="1em"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(html).toContain('viewBox="0 0 24 24"');

    // props forwarded
    expect(html).toContain('class="x"');
    expect(html).toContain('aria-label="bell"');

    // href composed from placeholder + # + iconId
    const expectedHref = `${PLACEHOLDER}#ri-BiAlarm`;
    expect(html).toContain(`<use href="${expectedHref}"></use>`);
  });

  it('allows overriding default svg attributes via props', () => {
    const html = renderToStaticMarkup(
      <ReactIconsSpriteIcon
        iconId="ri-BiAlarm"
        height="2em"
        width="3em"
        viewBox="1 2 3 4"
        preserveAspectRatio="none"
        data-id="x"
        role="img"
      />,
    );

    // overrides
    expect(html).toContain('height="2em"');
    expect(html).toContain('width="3em"');
    expect(html).toContain('viewBox="1 2 3 4"');
    expect(html).toContain('preserveAspectRatio="none"');
    // passthrough attributes
    expect(html).toContain('data-id="x"');
    expect(html).toContain('role="img"');
  });
});
