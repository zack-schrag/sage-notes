import React, { useEffect, useState } from 'react';
import { StyleSheet, View, SafeAreaView, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getToken } from '@/utils/tokenStorage';
import { listMarkdownFiles, REPOS_DIR, createNewNote } from '@/utils/fileSystem';
import { Ionicons } from '@expo/vector-icons';

interface NoteCard {
  title: string;
  path: string;
}

export default function RecentScreen() {
  const [recentNotes, setRecentNotes] = useState<NoteCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentNotes = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) {
          router.replace('/(tabs)/');
          return;
        }

        const files = await listMarkdownFiles();
        const notes = files.slice(0, 10).map(path => ({
          title: path.split('/').pop() || 'Untitled.md',
          path: `${REPOS_DIR}notes/${path}`,
        }));
        setRecentNotes(notes);
      } catch (error) {
        console.error('Error loading recent notes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentNotes();
  }, []);

  const handleNewNote = async () => {
    try {
      const { filePath } = await createNewNote();
      router.push({
        pathname: '/(tabs)/notes',
        params: { filePath }
      });
    } catch (error) {
      console.error('Error creating new note:', error);
    }
  };

  const handleNotePress = (path: string) => {
    router.push({
      pathname: '/(tabs)/notes',
      params: { filePath: path }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {isLoading ? (
            <ThemedText style={styles.loadingText}>Loading notes...</ThemedText>
          ) : recentNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>No notes yet</ThemedText>
            </View>
          ) : (
            <View style={styles.notesContainer}>
              {recentNotes.map((note) => (
                <Pressable
                  key={note.path}
                  style={styles.noteCard}
                  onPress={() => handleNotePress(note.path)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#666"
                    style={styles.icon}
                  />
                  <ThemedText style={styles.noteTitle}>{note.title}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  notesContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
    width: 20,
    opacity: 0.6,
  },
  noteTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#e0e0e0',
  },
  loadingText: {
    paddingHorizontal: 30,
    paddingTop: 20,
    color: '#888',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 15,
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
