'use client';

import { Select as HeroSelect, type SelectProps } from '@heroui/react';

// HeroUI 2.7 restarts a select popover's open animation when it repositions (~300 ms after opening) and again on
// close, so the list visibly flashed. The app's selects come from here, with that animation off.
export const Select = <T extends object>(props: SelectProps<T>) => <HeroSelect disableAnimation {...props} />;
