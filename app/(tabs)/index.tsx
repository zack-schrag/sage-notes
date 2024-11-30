import React, { useEffect, useState } from 'react';
import { StyleSheet, View, SafeAreaView, Pressable, Alert, ScrollView, RefreshControl, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FileTree } from '@/components/FileTree';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getDirectoryStructure, createNewNote, deleteItems, REPOS_DIR, listMarkdownFiles } from '@/utils/fileSystem';
import { getToken } from '@/utils/tokenStorage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { syncFromGitHub } from '@/utils/githubSync';
import * as FileSystem from 'expo-file-system';
import { formatTimeAgo } from '@/utils/dateFormat';

interface RecentFile {
  title: string;
  path: string;
  modifiedTime: Date;
}

export default function FilesScreen() {
  const [fileTree, setFileTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [timeAgoText, setTimeAgoText] = useState<string>('');

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

      // Load recent files
      const files = await listMarkdownFiles();
      const recentNotes = await Promise.all(
        files.slice(0, 5).map(async (path) => {
          const fullPath = `${REPOS_DIR}notes/${path}`;
          const fileInfo = await FileSystem.getInfoAsync(fullPath);
          return {
            title: path.split('/').pop() || 'Untitled.md',
            path: fullPath,
            modifiedTime: new Date(fileInfo.modificationTime * 1000)
          };
        })
      );
      setRecentFiles(recentNotes);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadFiles();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Running timer...');
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastSyncTime) return;

    const updateTimeAgo = () => {
      const newText = formatTimeAgo(lastSyncTime);
      console.log('Updating time ago:', newText);
      setTimeAgoText(newText);
    };

    // Update immediately
    updateTimeAgo();

    // Then update every 10 seconds
    const timer = setInterval(updateTimeAgo, 10000);

    return () => clearInterval(timer);
  }, [lastSyncTime]);

  const handleFilePress = (path: string) => {
    router.push({
      pathname: '/(tabs)/notes',
      params: { filePath: path }
    });
  };

  const handleNewNote = async () => {
    try {
      const { filePath } = await createNewNote();
      await loadFiles();
      router.push({
        pathname: '/(tabs)/notes',
        params: { filePath }
      });
    } catch (error) {
      console.error('Error creating new note:', error);
    }
  };

  const handleSelectionChange = (paths: string[]) => {
    setSelectedPaths(paths);
  };

  const handleDelete = async () => {
    if (selectedPaths.length === 0) return;

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${selectedPaths.length} item${selectedPaths.length === 1 ? '' : 's'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItems(selectedPaths);
              setSelectedPaths([]);
              setIsSelectionMode(false);
              await loadFiles();
            } catch (error) {
              console.error('Error deleting items:', error);
              Alert.alert('Error', 'Failed to delete some items');
            }
          }
        }
      ]
    );
  };

  const handleSync = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      await syncFromGitHub();
      await loadFiles();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error syncing with GitHub:', error);
      Alert.alert('Sync Error', 'Failed to sync with GitHub. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Background sync every 5 minutes
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;
    
    const startBackgroundSync = () => {
      // Initial sync when component mounts
      handleSync();
      
      // Then sync every 5 minutes
      syncInterval = setInterval(() => {
        console.log('Running background sync...');
        handleSync();
      }, 5 * 60 * 1000); // 5 minutes in milliseconds
    };

    startBackgroundSync();

    // Cleanup interval on unmount
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {isLoading ? (
          <ThemedText style={styles.loadingText}>Loading files...</ThemedText>
        ) : (
          <>
            <View style={styles.treeContainer}>
              {isSelectionMode && (
                <View style={styles.selectionHeader}>
                  <View style={styles.selectionHeaderContent}>
                    <ThemedText style={styles.selectionCount}>
                      {selectedPaths.length} selected
                    </ThemedText>
                    <View style={styles.selectionActions}>
                      {selectedPaths.length > 0 && (
                        <Pressable onPress={handleDelete} style={styles.headerButton}>
                          <IconSymbol name="trash" size={22} color="#dc2626" />
                        </Pressable>
                      )}
                      <Pressable 
                        onPress={() => {
                          setIsSelectionMode(false);
                          setSelectedPaths([]);
                        }} 
                        style={styles.headerButton}
                      >
                        <ThemedText style={{ color: '#87A987', fontSize: 16 }}>Cancel</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
              <ScrollView 
                contentInsetAdjustmentBehavior="automatic"
                refreshControl={
                  <RefreshControl
                    refreshing={isSyncing}
                    onRefresh={handleSync}
                    tintColor="#666"
                    colors={["#87A987"]}
                    progressBackgroundColor="#1a1a1a"
                  />
                }
              >
                <FileTree 
                  data={fileTree} 
                  onFilePress={handleFilePress}
                  onSelectionChange={handleSelectionChange}
                  onSelectionModeChange={setIsSelectionMode}
                  isSelectionMode={isSelectionMode}
                />
              </ScrollView>
            </View>

            {!isSelectionMode && (
              <View style={styles.recentSection}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScrollContent}
                >
                  {recentFiles.map((file) => (
                    <Pressable
                      key={file.path}
                      style={styles.recentCard}
                      onPress={() => handleFilePress(file.path)}
                    >
                      <IconSymbol name="doc.text" size={24} color="#87A987" />
                      <View style={styles.recentCardContent}>
                        <ThemedText style={styles.recentFileName} numberOfLines={1}>
                          {file.title}
                        </ThemedText>
                        <ThemedText style={styles.recentFileTime}>
                          {file.modifiedTime.toLocaleDateString()}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {lastSyncTime && !isSelectionMode && (
              <ThemedText style={styles.lastSyncText}>
                Last synced {timeAgoText}
              </ThemedText>
            )}
          </>
        )}
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
    paddingTop: Platform.select({
      ios: 20,
      android: 60,
    }),
    paddingBottom: Platform.select({
      ios: 80,
      android: 40,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  treeContainer: {
    flex: 1,
  },
  loadingText: {
    paddingHorizontal: 30,
    paddingTop: 20,
    color: '#888',
  },
  selectionHeader: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  selectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 16,
    color: '#87A987',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerButton: {
    padding: 8,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 4,
    textAlign: 'center',
    marginBottom: Platform.select({
      ios: 0,
      android: 8,
    }),
  },
  recentSection: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  recentScrollContent: {
    paddingHorizontal: 12,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    width: 200,
  },
  recentCardContent: {
    marginLeft: 12,
    flex: 1,
  },
  recentFileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  recentFileTime: {
    fontSize: 12,
    color: '#666',
  },
});
