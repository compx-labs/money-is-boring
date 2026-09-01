import { StyleSheet, View } from 'react-native';
import { SittingCube } from '@/components/SittingCube';

export function LoadingScreen() {
  return (
    <View style={styles.wrap}>
      <SittingCube size={140} spin />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
