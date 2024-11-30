import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Pressable, View, Alert } from 'react-native';
import { router } from 'expo-router';

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
        <IconSymbol size={24} name="plus" color="#fff" />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
          height: 88,
          paddingBottom: 35,
        },
        tabBarIconStyle: {
          width: 32,
          marginTop: 12, // Add top padding to center icons vertically
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
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.dash" color={color} />,
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
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          href: null, // This hides it from the tab bar but keeps it in navigation
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  newNoteContainer: {
    position: 'relative',
    width: 120,
    height: 80,
    alignItems: 'center',
  },
  newNoteButton: {
    position: 'absolute',
    bottom: 35,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#87A987',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
