import { StyleSheet, Platform, TextInput, View, useWindowDimensions, Pressable, Text, Linking } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, ScrollView, StatusBar } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { saveFile } from '@/utils/fileSystem';
import { getFileMetadata, formatDate } from '@/utils/githubApi';
import { parseMarkdown, addTagToMarkdown, removeTagFromMarkdown } from '@/utils/markdownParser';
import { AddTagModal } from '@/components/AddTagModal';
import { scheduleCommit, hasPendingChanges } from '@/utils/githubSync';

const initialMarkdown = `# Welcome to Your Markdown Editor

Start typing here to create your notes...

## Markdown Support
- **Bold text**
- *Italic text*
- Lists like this one
- [Links](https://example.com)
`;

interface FileMetadata {
    filename: string;
    created: string;
    lastUpdated: string;
    htmlUrl: string;
    tags: string[];
}

export default function NotesScreen() {
    const { filePath } = useLocalSearchParams<{ filePath: string }>();
    const [markdownText, setMarkdownText] = useState(initialMarkdown);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isAddTagModalVisible, setIsAddTagModalVisible] = useState(false);
    const [metadata, setMetadata] = useState<FileMetadata>({
        filename: "New Note",
        created: "Just now",
        lastUpdated: "Just now",
        htmlUrl: "",
        tags: []
    });
    const { width } = useWindowDimensions();

    // Load file contents and metadata
    useEffect(() => {
        const loadFile = async () => {
            if (filePath) {
                try {
                    // Load file content
                    const content = await FileSystem.readAsStringAsync(filePath);
                    const { frontmatter, content: markdownContent } = parseMarkdown(content);
                    setMarkdownText(content);
                    
                    // Get relative path for GitHub API
                    const repoPath = filePath.split('/repos/notes/')[1];
                    if (repoPath) {
                        // Fetch GitHub metadata
                        const githubMetadata = await getFileMetadata(repoPath);
                        if (githubMetadata) {
                            setMetadata({
                                filename: githubMetadata.name,
                                created: formatDate(githubMetadata.created_at),
                                lastUpdated: formatDate(githubMetadata.updated_at),
                                htmlUrl: githubMetadata.html_url,
                                tags: frontmatter.tags || []
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error loading file:', error);
                }
            }
        };
        
        loadFile();
    }, [filePath]);

    // Auto-save functionality
    const debouncedSave = useCallback(async (text: string) => {
        if (!filePath) return;

        try {
            setIsSaving(true);
            const success = await saveFile(filePath, text);
            if (success) {
                setMetadata(prev => ({
                    ...prev,
                    lastUpdated: "Just now"
                }));
            }
        } catch (error) {
            console.error('Error auto-saving:', error);
        } finally {
            setIsSaving(false);
        }
    }, [filePath]);

    const handleTextChange = (text: string) => {
        setMarkdownText(text);
        setIsSaving(true);
        
        // Clear existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Set new timeout for auto-save
        const timeout = setTimeout(async () => {
            if (filePath) {
                try {
                    await saveFile(filePath, text);
                    // Schedule commit after successful save
                    scheduleCommit(filePath, text);
                    setHasUncommittedChanges(true);
                    // Check every second if changes are still pending
                    const checkInterval = setInterval(() => {
                        if (!hasPendingChanges(filePath)) {
                            setHasUncommittedChanges(false);
                            clearInterval(checkInterval);
                        }
                    }, 1000);
                } catch (error) {
                    console.error('Error saving file:', error);
                }
            }
            setIsSaving(false);
        }, 5000);
        
        setSaveTimeout(timeout);
    };

    const handleAddTag = useCallback((newTag: string) => {
        const updatedMarkdown = addTagToMarkdown(markdownText, newTag);
        setMarkdownText(updatedMarkdown);
        setMetadata(prev => ({
            ...prev,
            tags: [...prev.tags, newTag]
        }));
        // Trigger save
        debouncedSave(updatedMarkdown);
    }, [markdownText, debouncedSave]);

    const handleRemoveTag = useCallback((tagToRemove: string) => {
        const updatedMarkdown = removeTagFromMarkdown(markdownText, tagToRemove);
        setMarkdownText(updatedMarkdown);
        setMetadata(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
        // Trigger save
        debouncedSave(updatedMarkdown);
    }, [markdownText, debouncedSave]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
        };
    }, [saveTimeout]);

    const handleOpenInGitHub = () => {
        if (metadata.htmlUrl) {
            Linking.openURL(metadata.htmlUrl);
        }
    };
    
    const MetadataHeader = () => (
        <View style={styles.metadataContainer}>
            <SafeAreaView style={styles.metadataContent}>
                <View style={styles.filenameContainer}>
                    <Text style={styles.filename}>{metadata.filename}</Text>
                    <View style={styles.fileActions}>
                        {hasUncommittedChanges && (
                            <Text style={styles.pendingText}>Committing...</Text>
                        )}
                        {isSaving && (
                            <Text style={styles.savingText}>Saving...</Text>
                        )}
                        {metadata.htmlUrl && (
                            <Pressable onPress={handleOpenInGitHub} style={styles.githubLink}>
                                <Ionicons name="logo-github" size={20} color="#666" />
                            </Pressable>
                        )}
                    </View>
                </View>
                <View style={styles.dateSection}>
                    <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>Created</Text>
                        <Text style={styles.dateValue}>{metadata.created}</Text>
                    </View>
                    <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>Last updated</Text>
                        <Text style={styles.dateValue}>{metadata.lastUpdated}</Text>
                    </View>
                </View>
                <View style={styles.tagsSection}>
                    <View style={styles.tagsContainer}>
                        {metadata.tags.map((tag, index) => (
                            <Pressable
                                key={index}
                                onLongPress={() => handleRemoveTag(tag)}
                                style={styles.tag}
                            >
                                <Text style={styles.tagText}>#{tag}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable 
                        onPress={() => setIsAddTagModalVisible(true)} 
                        style={styles.addTagButton}
                    >
                        <Ionicons name="add-circle-outline" size={16} color="#0A84FF" />
                        <Text style={styles.addTagText}>Add tag</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );
    
    return (
        <>
            <ParallaxScrollView
                headerBackgroundColor={{ light: '#1a1a1a', dark: '#1a1a1a' }}
                headerHeight={220}
                headerImage={<MetadataHeader />}>
                <View style={{ flex: 1 }}>
                    <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
                        <View style={[styles.editorContainer, { backgroundColor: '#1a1a1a' }]}>
                            {!isPreviewMode ? (
                                <TextInput
                                    multiline
                                    value={markdownText}
                                    onChangeText={handleTextChange}
                                    style={[styles.textInput, { backgroundColor: '#1a1a1a' }]}
                                    placeholder="Start typing your markdown..."
                                    placeholderTextColor="#666"
                                />
                            ) : (
                                <ScrollView style={[styles.previewContainer, { backgroundColor: '#1a1a1a' }]}>
                                    <Markdown style={markdownStyles}>
                                        {parseMarkdown(markdownText).content}
                                    </Markdown>
                                </ScrollView>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </ParallaxScrollView>
            <Pressable 
                style={styles.toggleButton} 
                onPress={() => setIsPreviewMode(!isPreviewMode)}
            >
                <IconSymbol
                    size={24}
                    color="#007AFF"
                    name={isPreviewMode ? "pencil" : "eye"}
                />
            </Pressable>
            <AddTagModal
                visible={isAddTagModalVisible}
                onClose={() => setIsAddTagModalVisible(false)}
                onAddTag={handleAddTag}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    metadataContainer: {
        backgroundColor: 'transparent',
        width: '100%',
        height: 210
    },
    metadataContent: {
        flex: 1,
        paddingBottom: 8,
        justifyContent: 'flex-end'
    },
    filenameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },
    filename: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e0e0e0',
        paddingLeft: 30
    },
    fileActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    pendingText: {
        color: '#FFA500',
        fontSize: 12,
    },
    savingText: {
        color: '#666',
        fontSize: 12,
    },
    githubLink: {
        marginLeft: 8,
        padding: 4,
    },
    dateSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        width: '100%',
        paddingRight: 20,
        paddingLeft: 30,
    },
    dateItem: {
        flex: 1,
        paddingRight: 10,
    },
    dateLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 2,
        includeFontPadding: false,
        fontWeight: '400',
    },
    dateValue: {
        fontSize: 14,
        color: '#bbb',
        fontWeight: '400',
        includeFontPadding: false,
    },
    editorContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        minHeight: '100%',
    },
    toggleButton: {
        position: 'absolute',
        right: 20,
        top: 220,
        zIndex: 999,
        padding: 10,
        width: 36,
        height: 36,
        backgroundColor: 'rgba(45, 45, 45, 0.95)',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    textInput: {
        flex: 1,
        padding: 20,
        fontSize: 16,
        lineHeight: 24,
        color: '#fff',
        minHeight: '100%',
    },
    previewContainer: {
        flex: 1,
        padding: 20,
        minHeight: '100%',
    },
    tagsSection: {
        paddingHorizontal: 20,
        paddingVertical: 4,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 6,
    },
    tag: {
        backgroundColor: 'rgba(45, 45, 45, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tagText: {
        color: '#0A84FF',
        fontSize: 13,
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 5,
        paddingLeft: 2
    },
    addTagText: {
        color: '#0A84FF',
        fontSize: 14,
    },
});

const markdownStyles = {
    body: {
        fontSize: 16,
        lineHeight: 24,
        color: '#e0e0e0',
        backgroundColor: '#1a1a1a',
    },
    heading1: {
        fontSize: 24,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    heading2: {
        fontSize: 20,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    paragraph: {
        marginVertical: 8,
        color: '#e0e0e0',
    },
    list: {
        marginLeft: 20,
        color: '#e0e0e0',
    },
    listItem: {
        color: '#e0e0e0',
    },
    link: {
        color: '#0A84FF',
    },
    blockquote: {
        color: '#bbb',
        borderColor: '#666',
    },
    code_inline: {
        color: '#0A84FF',
        backgroundColor: 'rgba(45, 45, 45, 0.95)',
    },
    code_block: {
        backgroundColor: 'rgba(45, 45, 45, 0.95)',
        color: '#e0e0e0',
    },
};