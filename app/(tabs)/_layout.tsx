import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Pressable, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createNewNote } from '@/utils/fileSystem';

function NewNoteButton() {
  const handleNewNote = async () => {
    try {
      const { filePath } = await createNewNote();
      router.push({
        pathname: '/(tabs)/notes',
        params: { filePath }
      });
    } catch (error) {
      console.error('Error creating new note:', error);
      Alert.alert('Error', 'Failed to create new note. Please try again.');
    }
  };

  return (
    <View style={styles.newNoteContainer}>
      <Pressable onPress={handleNewNote} style={styles.newNoteButton}>
        <IconSymbol
          size={Platform.select({ ios: 24, android: 28 })}
          name="plus"
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#2a2a2a');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#1a1a1a" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: {
            backgroundColor: Platform.select({
              ios: 'transparent',
              android: '#2a2a2a', // matching the recent cards background
            }),
            borderTopWidth: 0,
            elevation: 0,
            height: Platform.select({
              ios: 80,
              android: 85,
            }),
            ...Platform.select({
              ios: {
                position: 'absolute',
              },
              android: {
                paddingBottom: 12,
                borderTopColor: '#ffffff08', // even more subtle border
                borderTopWidth: 0.5,
              },
            }),
          },
          tabBarIconStyle: {
            width: 32,
            height: Platform.select({
              ios: 32,
              android: 80,
            }),
            marginTop: Platform.select({
              ios: 12,
              android: 0,
            }),
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarLabelStyle: {
            display: 'none', // Hide all labels
          },
        }}
        defaultScreenOptions={{
          initialRouteName: 'index',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Files',
            tabBarIcon: ({ color }) => (
              <View style={styles.tabIconContainer}>
                <IconSymbol
                  size={Platform.select({ ios: 28, android: 34 })}
                  name="list.dash"
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="new"
          options={{
            title: '',
            tabBarButton: () => <NewNoteButton />,
          }}
          listeners={{
            tabPress: (e) => {
              // Prevent default action
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <View style={styles.tabIconContainer}>
                <IconSymbol
                  size={Platform.select({ ios: 28, android: 34 })}
                  name="gearshape.fill"
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            href: null, // This hides it from the tab bar but keeps it in navigation
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    height: Platform.select({
      ios: 32,
      android: 40,
    }),
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.select({
      ios: 0,
      android: 0,
    }),
  },
  newNoteContainer: {
    position: 'relative',
    width: Platform.select({
      ios: 120,
      android: 136,
    }),
    height: Platform.select({
      ios: 80,
      android: 65,
    }),
    alignItems: 'center',
  },
  newNoteButton: {
    position: 'absolute',
    bottom: Platform.select({
      ios: 35,
      android: 7,
    }),
    width: Platform.select({
      ios: 56,
      android: 70,
    }),
    height: Platform.select({
      ios: 56,
      android: 70,
    }),
    borderRadius: Platform.select({
      ios: 28,
      android: 35,
    }),
    backgroundColor: '#87A987',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 8,
        overflow: 'hidden',
      },
    }),
  },
});
