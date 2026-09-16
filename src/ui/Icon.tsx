import Svg, { Path, type SvgProps } from 'react-native-svg';

export const iconNames = [
  'check',
  'edit',
  'hourglass',
  'chevron-down',
  'chevron-up',
  'trash',
  'plus',
  'restore',
] as const;

export type IconName = (typeof iconNames)[number];
export type IconSize = 16 | 20 | 24;

type IconProps = Omit<SvgProps, 'children' | 'height' | 'width'> & {
  name: IconName;
  size?: IconSize;
};

const paths: Record<IconName, React.ReactNode> = {
  check: <Path d="M4.75 12.4 9.3 16.75 19.25 6.75" />,
  edit: (
    <>
      <Path d="m4.75 19.25 1.05-4.1L16.15 4.8l3.05 3.05L8.85 18.2l-4.1 1.05Z" />
      <Path d="m14.55 6.4 3.05 3.05" />
    </>
  ),
  hourglass: (
    <>
      <Path d="M6.75 4.25h10.5M6.75 19.75h10.5M8.25 4.25c0 3.75 1.35 5.85 3.75 7.75-2.4 1.9-3.75 4-3.75 7.75M15.75 4.25c0 3.75-1.35 5.85-3.75 7.75 2.4 1.9 3.75 4 3.75 7.75" />
      <Path d="m9.4 17.8 2.6-2.65 2.6 2.65Z" fill="currentColor" stroke="none" />
    </>
  ),
  'chevron-down': <Path d="m5.75 9.25 6.25 5.5 6.25-5.5" />,
  'chevron-up': <Path d="m5.75 14.75 6.25-5.5 6.25 5.5" />,
  trash: <Path d="M5.25 7h13.5M9 7V4.75h6V7M7.25 7l.9 12.5h7.7l.9-12.5M10.25 10.5v5.75M13.75 10.5v5.75" />,
  plus: <Path d="M12 4.75v14.5M4.75 12h14.5" />,
  restore: (
    <>
      <Path d="M8.25 8H4.25V4" />
      <Path d="M5 8A8 8 0 1 1 4.75 15.75" />
      <Path d="M4.25 4v4h4Z" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({ name, size = 20, color = 'currentColor', ...rest }: IconProps) {
  return (
    <Svg
      {...rest}
      accessible={false}
      accessibilityElementsHidden
      color={color}
      fill="none"
      focusable={false}
      height={size}
      importantForAccessibility="no-hide-descendants"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </Svg>
  );
}
