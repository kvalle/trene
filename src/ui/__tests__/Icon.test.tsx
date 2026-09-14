import { render, screen } from '@testing-library/react-native';

import { Icon, iconNames } from '../Icon';

describe('Icon', () => {
  it.each(iconNames)('renders the %s icon', (name) => {
    render(<Icon name={name} testID={`icon-${name}`} />);

    expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('uses currentColor and stays decorative', () => {
    render(<Icon name="check" testID="icon" />);

    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('color', 'currentColor');
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('fill', 'none');
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('stroke', 'currentColor');
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('accessible', false);
    expect(screen.queryByLabelText('check')).not.toBeOnTheScreen();
  });

  it('accepts only declared icon names', () => {
    // @ts-expect-error This verifies the public name union during typecheck.
    const invalidIcon = <Icon name="unknown" />;
    expect(invalidIcon.props.name).toBe('unknown');
  });

  it.each([16, 20, 24] as const)('supports the %s px size', (size) => {
    render(<Icon name="plus" size={size} testID="icon" />);

    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('width', size);
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveProp('height', size);
  });
});
