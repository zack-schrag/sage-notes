import React, { useState } from 'react';
import { Modal, View, StyleSheet, TextInput, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors, sageGreen } from '@/constants/Colors';
import { IconSymbol } from './ui/IconSymbol';

interface CreateFolderModalProps {
    isVisible: boolean;
    onClose: () => void;
    onCreateFolder: (folderName: string) => void;
    currentPath?: string;
}

export function CreateFolderModal({ isVisible, onClose, onCreateFolder, currentPath }: CreateFolderModalProps) {
    const [folderName, setFolderName] = useState('');
    const [error, setError] = useState('');

    const handleCreate = () => {
        // Basic validation
        if (!folderName.trim()) {
            setError('Folder name cannot be empty');
            return;
        }
        
        if (folderName.includes('/') || folderName.includes('\\')) {
            setError('Folder name cannot contain slashes');
            return;
        }

        onCreateFolder(folderName);
        setFolderName('');
        setError('');
        onClose();
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                    <ThemedView style={styles.container}>
                        {currentPath && (
                            <ThemedText style={styles.path}>in {currentPath}</ThemedText>
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="Folder name"
                            placeholderTextColor="#666"
                            value={folderName}
                            onChangeText={(text) => {
                                setFolderName(text);
                                setError('');
                            }}
                            autoFocus={true}
                            onSubmitEditing={handleCreate}
                        />

                        {error ? (
                            <ThemedText style={styles.error}>{error}</ThemedText>
                        ) : null}

                        <View style={styles.buttonContainer}>
                            <Pressable style={styles.button} onPress={onClose}>
                                <ThemedText>Cancel</ThemedText>
                            </Pressable>
                            <Pressable 
                                style={[styles.button, styles.createButton]} 
                                onPress={handleCreate}
                            >
                                <ThemedText style={styles.createButtonText}>Create</ThemedText>
                            </Pressable>
                        </View>
                    </ThemedView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 12,
        overflow: 'hidden',
    },
    container: {
        padding: 24,
    },
    path: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        color: Colors.dark.text,
        backgroundColor: '#222',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    error: {
        color: '#ff6b6b',
        fontSize: 14,
        marginBottom: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    createButton: {
        backgroundColor: sageGreen,
    },
    createButtonText: {
        color: '#000',
        fontWeight: '600',
    },
});
