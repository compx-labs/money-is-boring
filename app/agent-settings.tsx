import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@tanstack/react-store';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { SheetScaffold, useSheetPalette } from '@/components/SheetScaffold';
import { ZsModelSelect } from '@/components/ZsModelSelect';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { BOTH_OFF_FOOTNOTE, bothConfirmsOff } from '@/lib/agent/confirm';
import { fonts } from '@/lib/theme';
import { listZsModels } from '@/lib/zerosignal/discover';
import {
  agentConfirmStore,
  setConfirmInference,
  setConfirmTools,
} from '@/stores/agent-confirm';
import { agentModelStore, setAgentModel } from '@/stores/agent-model';

function YesNoRows({
  label,
  value,
  onChange,
  ink,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  ink: string;
}) {
  const { accent } = useAccent();
  const { ink: chromeInk } = useChrome();
  const sheet = useSheetPalette();
  const fill = sheet?.ink ?? chromeInk;

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      <View style={styles.yesNo}>
        {([true, false] as const).map((option) => {
          const selected = value === option;
          const title = option ? 'yes' : 'no';
          return (
            <HapticPressable
              key={title}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${title}`}
              accessibilityState={{ selected }}
              style={styles.rowPress}
            >
              <Chamfer fill={fill} style={styles.row} contentStyle={styles.rowInner}>
                <Text style={[styles.choice, { color: selected ? accent : chromeInk }]}>
                  {title}
                </Text>
                {selected ? <MorphIcon name="checkmark" size={20} color={accent} bounce /> : null}
              </Chamfer>
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

function AgentSettingsBody() {
  const { bg } = useChrome();
  const model = useStore(agentModelStore, (state) => state);
  const confirm = useStore(agentConfirmStore, (state) => state);
  const [models, setModels] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void listZsModels()
      .then((ids) => {
        if (cancelled) return;
        setModels(ids);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: bg }]}>settings</Text>
      <View style={styles.block}>
        <Text style={[styles.label, { color: bg }]}>model</Text>
        <ZsModelSelect
          value={model}
          models={models}
          loading={loading}
          error={failed}
          onChange={setAgentModel}
        />
      </View>
      <YesNoRows
        label="confirm tool calls"
        value={confirm.confirmTools}
        onChange={setConfirmTools}
        ink={bg}
      />
      <YesNoRows
        label="confirm inference spend"
        value={confirm.confirmInference}
        onChange={setConfirmInference}
        ink={bg}
      />
      {bothConfirmsOff(confirm) ? (
        <Text style={[styles.footnote, { color: bg }]}>{BOTH_OFF_FOOTNOTE}</Text>
      ) : null}
    </View>
  );
}

export default function AgentSettings() {
  return (
    <SheetScaffold heightFraction={0.75}>
      <AgentSettingsBody />
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  block: {
    alignSelf: 'stretch',
    gap: 12,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  yesNo: {
    gap: 10,
  },
  rowPress: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
  },
  choice: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
});
