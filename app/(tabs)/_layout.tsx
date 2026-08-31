import { Redirect, Tabs } from 'expo-router';
import React, { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MorphIcon } from '@/components/MorphIcon';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { useProvider } from '@/hooks/useProvider';
import { findWalletAccount } from '@/lib/keystore/wallet-account';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  home: { on: 'home', off: 'home-outline' },
  agent: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  explore: { on: 'compass', off: 'compass-outline' },
};

function BottomTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const bottom = Math.max(insets.bottom, 12);
  const { accent, tabWash } = useAccent();
  const { tabFill } = useChrome();

  return (
    <View style={[styles.dock, { paddingBottom: bottom }]} pointerEvents="box-none">
      <Chamfer
        fill={tabFill}
        stroke={accent}
        strokeWidth={2}
        segments={state.routes.length}
        activeSegment={state.index}
        activeFill={tabWash}
        style={styles.barFace}
        contentStyle={styles.bar}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const icons = ICONS[route.name] ?? ICONS.home;

          return (
            <HapticPressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <MorphIcon
                name={focused ? icons.on : icons.off}
                size={24}
                color={accent}
              />
            </HapticPressable>
          );
        })}
      </Chamfer>
    </View>
  );
}

function renderTabBar(props: TabBarProps) {
  return <BottomTabBar {...props} />;
}

export default function TabsLayout() {
  const { keys, accounts } = useProvider();
  const { accent } = useAccent();
  const wallet = findWalletAccount(accounts, keys);

  if (keys.length === 0) return <Redirect href="/onboarding" />;
  if (!wallet) return <LoadingScreen />;

  return (
    <Tabs
      initialRouteName="home"
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: accent,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="agent" options={{ title: 'Agent' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  barFace: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  tabActive: {
    opacity: 1,
  },
});
