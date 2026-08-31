import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { HapticPressable } from '@/components/HapticPressable';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MorphIcon } from '@/components/MorphIcon';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { useColorMode } from '@/hooks/useColorMode';
import { useNickname } from '@/hooks/useNickname';
import { useProvider } from '@/hooks/useProvider';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { ICON_MORPH_MS } from '@/lib/motion/icon';
import { ACCENT_IDS, THEMES, colors, fonts, resolveAccent } from '@/lib/theme';
import { setAccent } from '@/stores/accent';
import { setColorMode } from '@/stores/colorMode';
import { setNickname } from '@/stores/nicknames';

const ICON_HOLD_MS = ICON_MORPH_MS + 280;

function ProfileBody() {
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const nickname = useNickname(address);
  const theme = useAccent();
  const { bg } = useChrome();
  const mode = useColorMode();
  const [copied, setCopied] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), ICON_HOLD_MS);
    return () => clearTimeout(id);
  }, [copied]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
  };

  const onEdit = () => {
    setDraft(nickname ?? '');
    setEditing(true);
  };

  const onSave = () => {
    setNickname(address, draft);
    setEditing(false);
  };

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: theme.accent }]}>profile</Text>
      <HapticPressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied address' : 'Copy address'}
        style={styles.addressPress}
      >
        <Chamfer
          fill={bg}
          stroke={theme.accent}
          strokeWidth={2}
          style={styles.addressFace}
          contentStyle={styles.addressInner}
        >
          <Text style={[styles.address, { color: theme.accent }]} numberOfLines={1}>
            {address}
          </Text>
          <MorphIcon
            name={copied ? 'checkmark' : 'copy-outline'}
            size={22}
            color={theme.accent}
            bounce={copied}
          />
        </Chamfer>
      </HapticPressable>

      {nickname && !editing ? (
        <View
          style={styles.nicknameRow}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Nickname: ${nickname}`}
        >
          <Text style={[styles.nicknameLabel, { color: theme.accent }]}>Nickname:</Text>
          <Text style={[styles.nickname, { color: theme.accent }]}>{nickname}</Text>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.composer}>
          <Chamfer fill={theme.surface} style={styles.inputFace} contentStyle={styles.inputInner}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="nickname"
              placeholderTextColor={colors.muted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onSave}
              style={styles.input}
              accessibilityLabel="Nickname"
            />
          </Chamfer>
          <ChamferButton label="save" onPress={onSave} compact overlap />
        </View>
      ) : (
        <ChamferButton
          label={nickname ? 'edit nickname' : 'set nickname'}
          onPress={onEdit}
        />
      )}

      <View style={styles.themeBlock}>
        <Text style={[styles.themeLabel, { color: theme.accent }]}>Select theme</Text>
        <View style={styles.swatchRow}>
          {ACCENT_IDS.map((id) => {
            const option = THEMES[id];
            const selected = theme.id === id;
            const swatch = resolveAccent(id, mode);
            return (
              <HapticPressable
                key={id}
                onPress={() => setAccent(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label} theme`}
                style={styles.swatchPress}
              >
                <Chamfer
                  fill={bg}
                  stroke={selected ? colors.button : 'transparent'}
                  strokeWidth={3}
                  contentInset={false}
                  style={styles.swatchOuter}
                  contentStyle={styles.swatchPad}
                >
                  <Chamfer
                    fill={swatch.accent}
                    contentInset={false}
                    style={styles.swatchInner}
                  />
                </Chamfer>
              </HapticPressable>
            );
          })}
        </View>
        <ChamferButton
          label={mode === 'light' ? 'dark mode' : 'light mode'}
          onPress={() => setColorMode(mode === 'light' ? 'dark' : 'light')}
        />
      </View>
    </View>
  );
}

export default function Profile() {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetScaffold>
        <ProfileBody />
      </SheetScaffold>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 28,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  addressPress: {
    alignSelf: 'stretch',
  },
  addressFace: {
    alignSelf: 'stretch',
  },
  addressInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  address: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  nicknameLabel: {
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  nickname: {
    fontFamily: fonts.semibold,
    fontSize: 44,
    lineHeight: 52,
  },
  themeBlock: {
    alignSelf: 'stretch',
    gap: 12,
  },
  themeLabel: {
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  swatchPress: {
    flex: 1,
  },
  swatchOuter: {
    height: 44,
  },
  swatchPad: {
    flex: 1,
    padding: 4,
    justifyContent: 'center',
  },
  swatchInner: {
    height: 28,
    alignSelf: 'stretch',
  },
  composer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputFace: {
    flex: 1,
  },
  inputInner: {
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  input: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 17,
    padding: 0,
    margin: 0,
  },
});
