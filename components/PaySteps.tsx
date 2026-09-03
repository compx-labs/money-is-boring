import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SpringInsert } from '@/components/SpringInsert';
import { prepareLayoutSpring } from '@/lib/motion/layout';
import { fonts } from '@/lib/theme';
import { payStepLabel, type PayStepRow } from '@/lib/zerosignal/pay';

export function PaySteps({
  steps,
  error,
  ink,
}: {
  steps: PayStepRow[];
  error?: string;
  ink: string;
}) {
  const prevLen = React.useRef(0);
  React.useEffect(() => {
    if (steps.length > prevLen.current) prepareLayoutSpring();
    prevLen.current = steps.length;
  }, [steps.length]);

  return (
    <View style={styles.list}>
      {steps.map((row, i) => (
        <SpringInsert key={`${row.step}-${i}`}>
          <Text
            style={[
              styles.step,
              {
                color: ink,
                opacity: row.state === 'done' ? 0.5 : 1,
                fontFamily:
                  row.state === 'active' || row.state === 'error' ? fonts.semibold : fonts.regular,
              },
            ]}
          >
            {payStepLabel(row.step, row.amountLabel)}
          </Text>
          {row.state === 'error' && error ? (
            <Text style={[styles.error, { color: ink }]}>{error}</Text>
          ) : null}
        </SpringInsert>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  step: {
    fontFamily: fonts.regular,
    fontSize: 22,
    lineHeight: 28,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 15,
    marginTop: 4,
  },
});
