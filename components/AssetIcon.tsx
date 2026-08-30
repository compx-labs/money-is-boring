import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

const SIZE = 32;

export function AssetIcon({ unit, uri }: { unit: string; uri: string | undefined }) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(uri) && !failed;
  const letter = (unit.trim().charAt(0) || '?').toUpperCase();

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View style={styles.wrap} accessibilityIgnoresInvertColors>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.letter}>{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  image: {
    width: SIZE,
    height: SIZE,
  },
  letter: {
    color: colors.buttonText,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
  },
});
