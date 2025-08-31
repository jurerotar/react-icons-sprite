import type React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement> & {
  iconId: string;
};

export const ReactIconsSpriteIcon = ({ iconId, ...rest }: IconProps) => {
  const spriteHref = '__SPRITE_URL_PLACEHOLDER__';
  const iconHref = `${spriteHref}#${iconId}`;

  return (
    <svg
      height="1em"
      width="1em"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 24 24"
      {...rest}
    >
      <use href={iconHref} />
    </svg>
  );
};
