import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { findWalletAccount } from '@/lib/keystore/wallet-account';
import { colors, fonts } from '@/lib/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function BottomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const color = focused ? colors.text : colors.muted;
        const label = options.title ?? route.name;

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
            style={styles.tabItem}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            <Text style={[styles.tabLabel, { color }]}>{label}</Text>
          </HapticPressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);

  if (keys.length === 0) return <Redirect href="/onboarding" />;
  if (!wallet) return <LoadingScreen />;

  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MorphIcon
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
              bounce={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: 'Agent',
          tabBarIcon: ({ color, focused }) => (
            <MorphIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={color}
              bounce={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <MorphIcon
              name={focused ? 'compass' : 'compass-outline'}
              size={24}
              color={color}
              bounce={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 2,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
