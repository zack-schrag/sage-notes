import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, Pressable, Alert, ScrollView, RefreshControl, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FileTree } from '@/components/FileTree';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { getDirectoryStructure, createNewNote, deleteItems, REPOS_DIR, listMarkdownFiles } from '@/utils/fileSystem';
import { getToken } from '@/utils/tokenStorage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { isRepoConfigured } from '@/utils/repoSetup';
import * as FileSystem from 'expo-file-system';
import { formatTimeAgo } from '@/utils/dateFormat';
import { startBackgroundSync, stopBackgroundSync, forceSync, performFullSync } from '../../utils/syncManager';

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
  const isSelectionModeRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [timeAgoText, setTimeAgoText] = useState<string>('');
  const [isRepoSetup, setIsRepoSetup] = useState<boolean>(false);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      
      const isConfigured = await isRepoConfigured();
      setIsRepoSetup(isConfigured);
      
      if (!isConfigured) {
        setIsLoading(false);
        return;
      }

      const token = await getToken();
      if (!token) {
        router.replace('/(tabs)/');
        return;
      }

      // Get directory structure first - this reads local files
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

  useEffect(() => {
    isSelectionModeRef.current = isSelectionMode;
  }, [isSelectionMode]);

  useEffect(() => {
    // Start background sync when component mounts
    if (isRepoSetup) {
      startBackgroundSync();
    }

    // Cleanup on unmount
    return () => {
      stopBackgroundSync();
    };
  }, [isRepoSetup]); // Restart sync when repo setup changes

  useEffect(() => {
    if (isRepoSetup && !lastSyncTime) {
      setLastSyncTime(new Date());
    }
  }, [isRepoSetup]);

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
              isSelectionModeRef.current = false;
              // await handleSync();
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
    console.log('Syncing...', isSelectionModeRef.current);
    if (isSyncing || isSelectionModeRef.current) {
      console.log('Already syncing or in selection mode');
      return;
    }
    
    try {
      setIsSyncing(true);
      await forceSync();
      await loadFiles();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error syncing with GitHub:', error);
      Alert.alert('Sync Error', 'Failed to sync with GitHub. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    console.log('Starting full sync...');
    if (isSyncing || isSelectionModeRef.current) {
      console.log('Already syncing or in selection mode');
      return;
    }
    
    try {
      setIsSyncing(true);
      await performFullSync();
      await loadFiles();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error during full sync:', error);
      Alert.alert('Full Sync Error', 'Failed to sync with GitHub. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {isLoading ? (
          <ThemedText style={styles.loadingText}>Loading files...</ThemedText>
        ) : !isRepoSetup ? (
          <View style={styles.setupContainer}>
            <IconSymbol name="github" size={48} color="#87A987" />
            <ThemedText style={styles.setupTitle}>GitHub Repository Required</ThemedText>
            <ThemedText style={styles.setupText}>
              To use Sage Notes, you'll need to connect it to a GitHub repository. This allows your notes to be securely stored and synced across devices.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={styles.setupButton}
            >
              <ThemedText style={styles.setupButtonText}>Set Up Repository</ThemedText>
            </Pressable>
          </View>
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

            {isRepoSetup && !isSelectionMode && (
              <View style={styles.syncContainer}>
                <ThemedText style={styles.lastSyncText}>
                  {lastSyncTime ? `Last synced ${timeAgoText}` : 'Not synced yet'}
                </ThemedText>
                <View style={styles.syncButtons}>
                  <Pressable
                    onPress={handleFullSync}
                    disabled={isSyncing}
                    style={styles.syncButton}
                  >
                    <IconSymbol name="refresh-cw" size={18} color="#87A987" />
                  </Pressable>
                </View>
              </View>
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
    textAlign: 'center',
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: Platform.select({
      ios: 0,
      android: 8,
    }),
    gap: 8,
  },
  syncButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  syncButton: {
    padding: 4,
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
  setupContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  setupText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  setupButton: {
    backgroundColor: '#87A987',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
});
