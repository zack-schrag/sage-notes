import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { FileTree } from '@/components/FileTree';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getDirectoryStructure } from '@/utils/fileSystem';
import { getToken } from '@/utils/tokenStorage';

export default function FilesScreen() {
  const [fileTree, setFileTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) {
          // If no token, user needs to set up repository first
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

    loadFiles();
  }, []);

  const handleFilePress = (path: string) => {
    // Navigate to notes tab with the selected file
    router.push({
      pathname: '/(tabs)/notes',
      params: { filePath: path }
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading files...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Repository Files</ThemedText>
      </View>
      <View style={styles.treeContainer}>
        <FileTree data={fileTree} onFilePress={handleFilePress} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  treeContainer: {
    flex: 1,
  },
});
