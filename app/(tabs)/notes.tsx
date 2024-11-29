import { StyleSheet, Platform, TextInput, View, useWindowDimensions, Pressable, Text } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar } from 'react-native';
import Markdown from 'react-native-markdown-display';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';

const initialMarkdown = `# Welcome to Your Markdown Editor

Start typing here to create your notes...

## Markdown Support
- **Bold text**
- *Italic text*
- Lists like this one
- [Links](https://example.com)
`;

// Hardcoded metadata for now
const noteMetadata = {
    filename: "recipes.md",
    created: "October 15, 2023",
    lastUpdated: "2 hours ago",
    tags: ["personal", "ideas", "draft"]
};

export default function TabTwoScreen() {
    const [markdownText, setMarkdownText] = useState(initialMarkdown);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const { width } = useWindowDimensions();
    
    const MetadataHeader = () => (
        <View style={styles.metadataContainer}>
            <SafeAreaView style={styles.metadataContent}>
                <Text style={styles.filename}>{noteMetadata.filename}</Text>
                <View style={styles.dateSection}>
                    <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>Created</Text>
                        <Text style={styles.dateValue}>{noteMetadata.created}</Text>
                    </View>
                    <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>Last updated</Text>
                        <Text style={styles.dateValue}>{noteMetadata.lastUpdated}</Text>
                    </View>
                </View>
                <View style={styles.tagsContainer}>
                    {noteMetadata.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                    ))}
                </View>
            </SafeAreaView>
        </View>
    );
    
    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: '#1a1a1a', dark: '#1a1a1a' }}
            headerHeight={175}
            headerImage={<MetadataHeader />}>
            <View style={{ flex: 1 }}>
                <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
                    <View style={[styles.editorContainer, { backgroundColor: '#1a1a1a', position: 'relative' }]}>
                        {!isPreviewMode ? (
                            <TextInput
                                multiline
                                value={markdownText}
                                onChangeText={setMarkdownText}
                                style={[styles.textInput, { backgroundColor: '#1a1a1a' }]}
                                placeholder="Start typing your markdown..."
                                placeholderTextColor="#666"
                            />
                        ) : (
                            <ScrollView style={[styles.previewContainer, { backgroundColor: '#1a1a1a' }]}>
                                <Markdown style={markdownStyles}>
                                    {markdownText}
                                </Markdown>
                            </ScrollView>
                        )}
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
                    </View>
                </SafeAreaView>
            </View>
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        height: '100%',
    },
    metadataContainer: {
        backgroundColor: 'transparent',
        width: '100%',
        height: 175,
    },
    metadataContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 12,
        justifyContent: 'flex-end'
    },
    filename: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e0e0e0',
        marginBottom: 12,
        paddingLeft: 20
    },
    dateSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        width: '100%',
        paddingRight: 20,
        paddingLeft: 20,
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
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        width: '100%',
        paddingLeft: 20,
        paddingBottom: 12
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
        fontWeight: '400',
    },
    editorContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        minHeight: '100%',
        paddingBottom: 120, 
    },
    toggleButton: {
        position: 'absolute',
        right: -10,
        top: -20,
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
        color: '#e0e0e0',
        fontSize: 16,
        lineHeight: 24,
        padding: 16,
        minHeight: '100%',
    },
    previewContainer: {
        flex: 1,
        padding: 16,
        minHeight: '100%',
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
