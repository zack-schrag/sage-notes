// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React from 'react';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'github': 'code',  // Using 'code' as a fallback since MaterialIcons doesn't have a GitHub icon
  'arrow.triangle.2.circlepath': 'sync',  // Adding sync icon
  'arrow.triangle.2.circlepath.circle.fill': 'sync', // Adding filled sync icon
  'list.dash': 'folder',  // Added for Files tab
  'gearshape.fill': 'settings',  // Added for Settings tab
  'plus': 'add',  // Added for New Note button
  'arrow.down.circle': 'download',  // Added for Clone Repo button
  'trash': 'delete',  // Added for Remove Repo button
  'eye': 'visibility',  // Added for show/hide token
  'eye.slash': 'visibility-off',  // Added for show/hide token
  'pencil': 'edit',  // Added for edit mode toggle
  'plus.circle.fill': 'add-circle',  // Added for Add tag button
  'doc.text': 'description',  // Added for file icon in recent section
} as Partial<
  Record<
    import('expo-symbols').SymbolViewProps['name'],
    React.ComponentProps<typeof MaterialIcons>['name']
  >
>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
