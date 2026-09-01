import { forwardRef, type ComponentProps } from 'react';
import type { TextInput } from 'react-native';

import { TextField } from './TextField';

type NumericFieldProps = Omit<ComponentProps<typeof TextField>, 'keyboardType'> & {
  kind: 'decimal' | 'integer';
};

export const NumericField = forwardRef<TextInput, NumericFieldProps>(function NumericField({ kind, ...props }, ref) {
  return <TextField {...props} ref={ref} keyboardType={kind === 'decimal' ? 'decimal-pad' : 'number-pad'} />;
});
