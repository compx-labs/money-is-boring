import { Redirect, withLayoutContext } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { type ParamListBase, type TabNavigationState } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { findWalletAccount } from '@/lib/keystore/wallet-account';
import { colors, fonts } from '@/lib/theme';

const { Navigator } = createMaterialTopTabNavigator();

const SwipeTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

function BottomTabBar({ state, descriptors, jumpTo, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const color = focused ? colors.text : colors.muted;
        const label = options.title ?? route.name;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) jumpTo(route.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            style={styles.tabItem}
          >
            {options.tabBarIcon?.({ focused, color })}
            <Text style={[styles.tabLabel, { color }]}>{label}</Text>
          </Pressable>
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
    <SwipeTabs
      initialRouteName="home"
      tabBarPosition="bottom"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <SwipeTabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <SwipeTabs.Screen
        name="agent"
        options={{
          title: 'Agent',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
        }}
      />
      <SwipeTabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={24} color={color} />
          ),
        }}
      />
    </SwipeTabs>
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
