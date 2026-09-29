import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme';

interface AvatarProps {
  name: string;
  uri?: string;
  size?: number;
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[typography.caption, { color: colors.white, fontSize: size * 0.36 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
