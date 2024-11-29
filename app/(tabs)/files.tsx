import React, { useEffect, useState } from 'react';
import { StyleSheet, View, SafeAreaView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FileTree } from '@/components/FileTree';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getDirectoryStructure, createNewNote } from '@/utils/fileSystem';
import { getToken } from '@/utils/tokenStorage';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function FilesScreen() {
  const [fileTree, setFileTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        router.replace('/(tabs)/');
        return;
      }

      const structure = await getDirectoryStructure();
      setFileTree(structure);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Refresh files when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadFiles();
    }, [])
  );

  const handleFilePress = (path: string) => {
    router.push({
      pathname: '/(tabs)/notes',
      params: { filePath: path }
    });
  };

  const handleNewNote = async () => {
    try {
      const { filePath } = await createNewNote();
      // Refresh the file tree
      await loadFiles();
      router.push({
        pathname: '/(tabs)/notes',
        params: { filePath }
      });
    } catch (error) {
      console.error('Error creating new note:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {isLoading ? (
          <ThemedText style={styles.loadingText}>Loading files...</ThemedText>
        ) : (
          <View style={styles.treeContainer}>
            <FileTree data={fileTree} onFilePress={handleFilePress} />
          </View>
        )}
        
        <Pressable onPress={handleNewNote} style={styles.newButton}>
          <IconSymbol name="plus" size={22} color="#e0e0e0" />
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 100,
  },
  treeContainer: {
    flex: 1,
  },
  loadingText: {
    paddingHorizontal: 30,
    paddingTop: 20,
    color: '#888',
  },
  newButton: {
    position: 'absolute',
    right: 30,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(45, 45, 45, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});
