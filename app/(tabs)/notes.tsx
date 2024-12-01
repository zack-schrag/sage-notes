import { Pressable, Text, TextInput, View, SafeAreaView, StyleSheet, Platform, Linking, AppState, Alert, Animated, Easing, ActionSheetIOS } from 'react-native';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StatusBar } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ensureRepoExists, saveFile, getDirectoryStructure } from '@/utils/fileSystem';
import { getToken, formatDate } from '@/utils/githubApi';
import { parseMarkdown, addTagToMarkdown, removeTagFromMarkdown } from '@/utils/markdownParser';
import { scheduleCommit, isActivelyCommitting, commitAllPendingChanges, commitFile, getRelativePath, deleteFile, getFileInfo } from '@/utils/githubSync';
import { SyncIndicator } from '@/components/SyncIndicator';
import { getRepoUrl } from '@/utils/tokenStorage';
import { parseRepoUrl } from '@/utils/githubUtils';

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
    tags: string[];
    created?: string;
    lastUpdated?: string;
    htmlUrl?: string;
    sha?: string;
    url?: string;
}

export default function NotesScreen() {
    const { filePath } = useLocalSearchParams<{ filePath: string }>();
    const router = useRouter();
    const [markdownText, setMarkdownText] = useState(initialMarkdown);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTagText, setNewTagText] = useState('');
    const [metadata, setMetadata] = useState<FileMetadata>({
        filename: filePath ? filePath.split('/').pop() || "New Note" : "New Note",
        created: "Just now",
        lastUpdated: "Just now",
        htmlUrl: "",
        tags: []
    });
    const [isEditingFilename, setIsEditingFilename] = useState(false);
    const [editedFilename, setEditedFilename] = useState('');
    const [isRenamingSaving, setIsRenamingSaving] = useState(false);
    const [renameTimeout, setRenameTimeout] = useState<NodeJS.Timeout | null>(null);
    const [selectionStart, setSelectionStart] = useState(0);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const tagAnimationsRef = useRef<Animated.Value[]>([]);
    const { width } = useWindowDimensions();

    const parseFilePath = (path: string) => {
        const filename = path.split('/').pop() || 'Untitled.md';
        return { filename };
    };

    useEffect(() => {
        async function loadFile() {
            if (!filePath) return;

            try {
                setIsSaving(true);
                
                // Phase 1: Immediate local file load
                const content = await FileSystem.readAsStringAsync(filePath);
                const { frontmatter, content: markdownContent } = parseMarkdown(content);
                setMarkdownText(markdownContent);

                // Initialize metadata with frontmatter dates if available
                const hasFrontmatterCreated = !!frontmatter.created;
                const hasFrontmatterUpdated = !!frontmatter.lastUpdated;

                setMetadata(prev => ({
                    ...prev,
                    filename: filePath.split('/').pop() || "New Note",
                    created: hasFrontmatterCreated ? formatDate(frontmatter.created) : "Just now",
                    lastUpdated: hasFrontmatterUpdated ? formatDate(frontmatter.lastUpdated) : "Just now",
                    tags: frontmatter.tags || []
                }));
                setIsSaving(false);

                // Phase 2: Background GitHub metadata load
                const loadGitHubMetadata = async () => {
                    const repoUrl = await getRepoUrl();
                    if (!repoUrl) return;

                    const repoInfo = parseRepoUrl(repoUrl);
                    if (!repoInfo) return;

                    const relativePath = getRelativePath(filePath);
                    if (!relativePath) return;

                    try {
                        // Get file info for SHA
                        const fileInfo = await getFileInfo(relativePath);
                        if (!fileInfo) return;

                        const sha = fileInfo.sha;
                        const htmlUrl = `https://github.com/${repoInfo.owner}/${repoInfo.name}/blob/main/${relativePath}`;

                        // Get commit history for dates
                        const token = await getToken();
                        if (!token) return;

                        const headers = {
                            Authorization: `token ${token}`,
                            Accept: 'application/vnd.github.v3+json',
                        };

                        // Only fetch commit dates if we don't have them in frontmatter
                        let firstCommitDate = undefined;
                        let lastCommitDate = undefined;

                        if (!hasFrontmatterCreated || !hasFrontmatterUpdated) {
                            // Get the latest commit (most recent)
                            const latestCommitUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/commits?path=${relativePath}&per_page=1`;
                            const latestCommitResponse = await fetch(latestCommitUrl, { headers });
                            const latestCommits = await latestCommitResponse.json();
                            lastCommitDate = latestCommits[0]?.commit?.committer?.date;

                            // Get total number of commits for this file
                            const commitCountUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/commits?path=${relativePath}&per_page=1`;
                            const countResponse = await fetch(commitCountUrl, { headers });
                            const linkHeader = countResponse.headers.get('link');
                            let totalPages = 1;
                            
                            if (linkHeader) {
                                const lastPageMatch = linkHeader.match(/&page=(\d+)>; rel="last"/);
                                if (lastPageMatch) {
                                    totalPages = parseInt(lastPageMatch[1]);
                                }
                            }

                            // Get the first commit (oldest) using the correct page number
                            const firstCommitUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.name}/commits?path=${relativePath}&per_page=1&page=${totalPages}`;
                            const firstCommitResponse = await fetch(firstCommitUrl, { headers });
                            const firstCommits = await firstCommitResponse.json();
                            firstCommitDate = firstCommits[0]?.commit?.committer?.date;
                        }

                        setMetadata(prev => ({
                            ...prev,
                            sha,
                            htmlUrl,
                            // Only update dates if they weren't in frontmatter
                            created: hasFrontmatterCreated ? prev.created : (firstCommitDate ? formatDate(firstCommitDate) : prev.created),
                            lastUpdated: hasFrontmatterUpdated ? prev.lastUpdated : (lastCommitDate ? formatDate(lastCommitDate) : prev.lastUpdated)
                        }));
                    } catch (error) {
                        console.error('Error loading GitHub metadata:', error);
                    }
                };

                // Start background load
                loadGitHubMetadata().catch(error => {
                    console.error('Background GitHub metadata load failed:', error);
                });

            } catch (error) {
                console.error('Error loading file:', error);
                setIsSaving(false);
            }
        }

        loadFile();
    }, [filePath]);

    // Monitor actual commit status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (filePath) {
            interval = setInterval(() => {
                setIsCommitting(isActivelyCommitting(filePath));
            }, 100);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [filePath]);

    // Handle app state changes
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Commit any pending changes before the app goes to background
                commitAllPendingChanges().catch(console.error);
            }
        });

        return () => {
            subscription.remove();
            // Also commit changes when unmounting the component
            commitAllPendingChanges().catch(console.error);
        };
    }, []);

    useEffect(() => {
        tagAnimationsRef.current = metadata.tags.map(() => new Animated.Value(0));
    }, [metadata.tags]);

    useEffect(() => {
        if (isEditingTags && tagAnimationsRef.current.length > 0) {
            // Start jiggle animations
            tagAnimationsRef.current.forEach(anim => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 100,
                            easing: Easing.linear,
                            useNativeDriver: true
                        }),
                        Animated.timing(anim, {
                            toValue: -1,
                            duration: 100,
                            easing: Easing.linear,
                            useNativeDriver: true
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 100,
                            easing: Easing.linear,
                            useNativeDriver: true
                        })
                    ])
                ).start();
            });

            return () => {
                // Stop animations when cleaning up
                tagAnimationsRef.current.forEach(anim => anim.setValue(0));
            };
        }
    }, [isEditingTags]);

    const debouncedSave = useCallback(async (text: string) => {
        if (!filePath) return;

        try {
            setIsSaving(true);
            const success = await saveFile(filePath, text);
            if (success) {
                setMetadata(prev => ({
                    ...prev,
                    lastUpdated: 'Just now'
                }));
            }
        } catch (error) {
            console.error('Error saving file:', error);
        } finally {
            setIsSaving(false);
        }
    }, [filePath]);

    const handleTextChange = useCallback((text: string) => {
        setMarkdownText(text);

        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        const timeout = setTimeout(async () => {
            try {
                // First save locally
                await debouncedSave(text);

                // Schedule commit if we have a file path
                if (filePath) {
                    // Check if file exists on GitHub and has been modified
                    const repoUrl = await getRepoUrl();
                    if (!repoUrl) return;

                    const repoInfo = parseRepoUrl(repoUrl);
                    if (!repoInfo) return;

                    const relativePath = getRelativePath(filePath);
                    if (!relativePath) return;

                    const fileInfo = await getFileInfo(relativePath);
                    if (fileInfo && fileInfo.sha !== metadata.sha) {
                        // Show conflict resolution dialog
                        Alert.alert(
                            'File Modified',
                            'This file has been modified on GitHub. How would you like to proceed?',
                            [
                                {
                                    text: 'View on GitHub',
                                    onPress: () => {
                                        if (metadata.htmlUrl) {
                                            Linking.openURL(metadata.htmlUrl);
                                        }
                                    }
                                },
                                {
                                    text: 'Keep My Changes',
                                    onPress: async () => {
                                        // Update SHA and save changes
                                        setMetadata(prev => ({ ...prev, sha: fileInfo.sha }));
                                        
                                        // Reconstruct content with frontmatter
                                        const frontmatter = {
                                            tags: metadata.tags
                                        };
                                        const fullContent = `---\ntags: [${frontmatter.tags.join(', ')}]\n---\n${text}`;
                                        scheduleCommit(filePath, fullContent);
                                    }
                                },
                                {
                                    text: 'Use GitHub Version',
                                    style: 'destructive',
                                    onPress: () => {
                                        // Parse the GitHub content and update local state
                                        const { frontmatter, content: markdownContent } = parseMarkdown(fileInfo.content);
                                        setMarkdownText(markdownContent);
                                        setMetadata(prev => ({ 
                                            ...prev, 
                                            sha: fileInfo.sha,
                                            tags: frontmatter.tags || prev.tags 
                                        }));
                                    }
                                }
                            ],
                            { cancelable: false }
                        );
                        return;
                    }

                    // No conflicts, proceed with commit
                    const frontmatter = {
                        tags: metadata.tags
                    };
                    const fullContent = `---\ntags: [${frontmatter.tags.join(', ')}]\n---\n${text}`;
                    scheduleCommit(filePath, fullContent);
                }
            } catch (error) {
                console.error('Error in auto-save:', error);
            }
        }, 1000);

        setSaveTimeout(timeout);
    }, [saveTimeout, debouncedSave, filePath, metadata.tags, metadata.sha, metadata.htmlUrl]);

    const handleAddTag = useCallback((newTag: string) => {
        const updatedTags = [...metadata.tags, newTag];
        setMetadata(prev => ({
            ...prev,
            tags: updatedTags
        }));

        // Save the updated tags
        const fullContent = `---\ntags: [${updatedTags.join(', ')}]\n---\n${markdownText}`;
        debouncedSave(fullContent);
    }, [markdownText, metadata.tags, debouncedSave]);

    const handleRemoveTag = useCallback((tagToRemove: string) => {
        const updatedTags = metadata.tags.filter(tag => tag !== tagToRemove);
        setMetadata(prev => ({
            ...prev,
            tags: updatedTags
        }));

        // Save the updated tags
        const fullContent = `---\ntags: [${updatedTags.join(', ')}]\n---\n${markdownText}`;
        debouncedSave(fullContent);
    }, [markdownText, metadata.tags, debouncedSave]);

    const handleStartEditingFilename = () => {
        // Remove the .md extension for editing
        const nameWithoutExt = metadata.filename.replace(/\.md$/, '');
        setEditedFilename(nameWithoutExt);
        setIsEditingFilename(true);
    };

    const handleFilenameChange = (newName: string) => {
        setEditedFilename(newName);
    };

    const handleSelectionChange = (event: any) => {
        setSelectionStart(event.nativeEvent.selection.start);
    };

    const handleSaveFilename = async () => {
        if (!filePath || !editedFilename || editedFilename + '.md' === metadata.filename) {
            setIsEditingFilename(false);
            return;
        }

        const finalFilename = editedFilename + '.md';

        try {
            setIsRenamingSaving(true);
            const oldPath = filePath;
            const baseDir = await ensureRepoExists();
            const newPath = `${baseDir}/${finalFilename}`;

            // Move the file locally
            await FileSystem.moveAsync({
                from: oldPath,
                to: newPath
            });

            // Update the filePath in the URL params to match the new path
            router.replace({
                pathname: '/(tabs)/notes',
                params: { filePath: newPath }
            });

            // Get the content before committing
            const content = await FileSystem.readAsStringAsync(newPath);

            // Only try to delete the old file from GitHub if we have its SHA
            // (meaning it exists in GitHub)
            if (metadata.sha) {
                await commitFile({ 
                    path: newPath, 
                    content, 
                    oldPath,
                    oldFileSha: metadata.sha,
                    message: `Rename ${metadata.filename} to ${finalFilename}` 
                });
            } else {
                // File doesn't exist in GitHub yet, just commit the new file
                await commitFile({ 
                    path: newPath, 
                    content,
                    message: `Create ${finalFilename}` 
                });
            }

            // Trigger a file tree refresh
            await getDirectoryStructure();

            setMetadata(prev => ({ ...prev, filename: finalFilename }));
            setIsEditingFilename(false);
        } catch (error) {
            console.error('Error renaming file:', error);
            // Try to move the file back if there was an error
            try {
                await FileSystem.moveAsync({
                    from: newPath,
                    to: oldPath
                });
                console.log('Rolled back file rename after error');
            } catch (rollbackError) {
                console.error('Error rolling back file rename:', rollbackError);
            }
        } finally {
            setIsRenamingSaving(false);
        }
    };

    const handleDeleteNote = useCallback(async () => {
        if (!filePath) return;

        try {
            // Delete from GitHub first if the file exists there
            if (metadata.sha) {
                await deleteFile(filePath, metadata.sha);
            }

            // Then delete locally
            await FileSystem.deleteAsync(filePath);

            // Navigate back to the notes list
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }, [filePath, metadata.sha, router]);

    const handleOpenInGitHub = () => {
        if (metadata.htmlUrl) {
            Linking.openURL(metadata.htmlUrl);
        }
    };

    const handleLongPressTag = (tag: string) => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Delete Tag'],
                    destructiveButtonIndex: 1,
                    cancelButtonIndex: 0,
                    title: `#${tag}`,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        handleRemoveTag(tag);
                    }
                }
            );
        } else {
            // For Android, show an Alert with options
            Alert.alert(
                `#${tag}`,
                'Choose an action',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    },
                    {
                        text: 'Delete Tag',
                        onPress: () => handleRemoveTag(tag),
                        style: 'destructive'
                    }
                ],
                { cancelable: true }
            );
        }
    };

    const handleTagPress = (tag: string) => {
        if (isEditingTags) {
            handleRemoveTag(tag);
        }
    };

    const MetadataHeader = () => (
        <View style={styles.metadataContainer}>
            <SafeAreaView style={styles.metadataContent}>
                <View style={styles.filenameContainer}>
                    <View style={styles.filenameSection}>
                        <View style={styles.filenameInputContainer}>
                            {isEditingFilename ? (
                                <>
                                    <TextInput
                                        value={editedFilename}
                                        onChangeText={handleFilenameChange}
                                        onBlur={handleSaveFilename}
                                        onSubmitEditing={handleSaveFilename}
                                        blurOnSubmit={true}
                                        onSelectionChange={handleSelectionChange}
                                        selection={{ start: selectionStart, end: selectionStart }}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoFocus
                                        style={[styles.filename, styles.filenameInput]}
                                    />
                                    <Text style={[styles.filename, styles.extensionText]}>.md</Text>
                                </>
                            ) : (
                                <Pressable onPress={handleStartEditingFilename}>
                                    <Text style={styles.filename}>{metadata.filename}</Text>
                                </Pressable>
                            )}
                            {isRenamingSaving && (
                                <Text style={styles.savingIndicator}>Saving...</Text>
                            )}
                        </View>
                        {metadata.htmlUrl && (
                            <Pressable onPress={handleOpenInGitHub} style={styles.githubButton}>
                                <Ionicons name="logo-github" size={20} color="#666" />
                            </Pressable>
                        )}
                    </View>
                    <Pressable 
                        onPress={handleDeleteNote}
                        style={styles.deleteButton}
                    >
                        <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    </Pressable>
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
                                onLongPress={() => handleLongPressTag(tag)}
                                style={styles.tag}
                            >
                                <View style={styles.tagInner}>
                                    <Text style={styles.tagText}>#{tag}</Text>
                                </View>
                            </Pressable>
                        ))}
                        {isAddingTag ? (
                            <View style={styles.tag}>
                                <TextInput
                                    style={styles.tagInput}
                                    value={newTagText}
                                    onChangeText={setNewTagText}
                                    placeholder="tag"
                                    placeholderTextColor="#666"
                                    autoFocus={true}
                                    autoCapitalize="none"
                                    onSubmitEditing={() => {
                                        if (newTagText.trim()) {
                                            handleAddTag(newTagText.trim());
                                            setNewTagText('');
                                        }
                                        setIsAddingTag(false);
                                    }}
                                    onBlur={() => {
                                        setIsAddingTag(false);
                                        setNewTagText('');
                                    }}
                                />
                            </View>
                        ) : (
                            <Pressable 
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setIsAddingTag(true);
                                }} 
                                style={styles.addTagButton}
                            >
                                <IconSymbol name="plus.circle.fill" size={22} color="#87A987" />
                            </Pressable>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            if (renameTimeout) {
                clearTimeout(renameTimeout);
            }
        };
    }, [saveTimeout, renameTimeout]);

    return (
        <Pressable 
            style={styles.container} 
            onPress={() => {
                if (isEditingTags) {
                    setIsEditingTags(false);
                }
            }}
        >
            <SafeAreaView style={styles.container}>
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
                        color="#87A987"
                        name={isPreviewMode ? "pencil" : "eye"}
                    />
                </Pressable>
            </SafeAreaView>
        </Pressable>
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
        justifyContent: 'space-between',
        width: '100%',
    },
    filenameSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filename: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e0e0e0',
        paddingLeft: 30
    },
    filenameInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    filenameInput: {
        color: '#e0e0e0',
        fontSize: 20,
        fontWeight: '600',
        minWidth: 100,
        padding: 0,
        margin: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#666',
    },
    extensionText: {
        color: '#888',
        marginLeft: -4, // Tighten up the spacing between filename and extension
    },
    githubButton: {
        padding: 4,
        marginLeft: 4,
    },
    deleteButton: {
        padding: 8,
        marginRight: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    iconButton: {
        padding: 8,
        marginLeft: 4,
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
        paddingTop: Platform.select({
            ios: 0,
            android: 24,
        }),
        paddingHorizontal: Platform.select({
            ios: 0,
            android: 20,
        }),
        paddingBottom: Platform.select({
            ios: 0,
            android: 20,
        }),
    },
    toggleButton: {
        position: 'absolute',
        right: Platform.select({
            ios: 20,
            android: 16,
        }),
        top: Platform.select({
            ios: 220,
            android: 232,
        }),
        zIndex: 999,
        padding: Platform.select({
            ios: 10,
            android: 16,
        }),
        width: Platform.select({
            ios: 36,
            android: 56,
        }),
        height: Platform.select({
            ios: 36,
            android: 56,
        }),
        backgroundColor: '#2a2a2a',
        borderRadius: Platform.select({
            ios: 18,
            android: 28,
        }),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    textInput: {
        flex: 1,
        color: '#e0e0e0',
        fontSize: 16,
        lineHeight: Platform.select({
            ios: 24,
            android: 28,
        }),
        textAlignVertical: 'top',
        paddingTop: Platform.select({
            ios: 0,
            android: 16,
        }),
        paddingBottom: Platform.select({
            ios: 0,
            android: 16,
        }),
        minHeight: '100%',
    },
    previewContainer: {
        flex: 1,
        paddingHorizontal: Platform.select({
            ios: 0,
            android: 4,
        }),
    },
    tagsSection: {
        paddingHorizontal: 30,
        paddingVertical: 4,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 6,
    },
    tag: {
        marginRight: 8,
        marginBottom: 8,
    },
    tagInner: {
        backgroundColor: 'rgba(135, 169, 135, 0.4)', // Sage green with 30% opacity
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tagText: {
        color: '#87A987', // Back to sage green for text
        fontSize: 14,
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 0,
        paddingHorizontal: 0,
        backgroundColor: '#3a3a3a0',
        borderRadius: 16,
        marginBottom: 8,
    },
    savingIndicator: {
        color: '#666',
        fontSize: 14,
    },
    tagInput: {
        color: '#87A987',
        fontSize: 14,
        minWidth: 60,
        padding: 0,
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
    heading3: {
        fontSize: 18,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    heading4: {
        fontSize: 16,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    heading5: {
        fontSize: 14,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    heading6: {
        fontSize: 12,
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    paragraph: {
        marginVertical: 8,
        color: '#e0e0e0',
    },
    hr: { 
        backgroundColor: '#333',
        height: 1,
        marginVertical: 16,
    },
    strong: { 
        fontWeight: 'bold',
        color: '#e0e0e0',
    },
    em: { 
        fontStyle: 'italic',
        color: '#e0e0e0',
    },
    link: { 
        color: '#87A987',
        textDecorationLine: 'underline',
    },
    blockquote: { 
        backgroundColor: '#222',
        borderLeftWidth: 4,
        borderLeftColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginVertical: 8,
    },
    code_inline: { 
        color: '#e0e0e0',
        backgroundColor: '#222',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    code_block: { 
        color: '#e0e0e0',
        backgroundColor: '#222',
        padding: 12,
        borderRadius: 4,
        marginVertical: 8,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fence: { 
        color: '#e0e0e0',
        backgroundColor: '#222',
        padding: 12,
        borderRadius: 4,
        marginVertical: 8,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    list_item: { 
        color: '#e0e0e0',
        marginVertical: 4,
        paddingLeft: 4,
    },
    bullet_list: { 
        color: '#e0e0e0',
        marginVertical: 8,
    },
    ordered_list: { 
        color: '#e0e0e0',
        marginVertical: 8,
    },
    bullet: { 
        color: '#87A987',
    },
    tag: { 
        color: '#87A987',
    }
};
