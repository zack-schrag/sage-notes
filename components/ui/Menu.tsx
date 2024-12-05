import React from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { IconSymbol } from './IconSymbol';

interface MenuItem {
    label: string;
    icon: string;
    onPress: () => void;
}

interface MenuProps {
    visible: boolean;
    onDismiss: () => void;
    items: MenuItem[];
}

export function Menu({ visible, onDismiss, items }: MenuProps) {
    return (
        <Modal
            transparent
            visible={visible}
            onRequestClose={onDismiss}
            animationType="fade"
        >
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <ThemedView style={styles.menu}>
                    {items.map((item, index) => (
                        <Pressable
                            key={item.label}
                            style={({ pressed }) => [
                                styles.menuItem,
                                pressed && styles.menuItemPressed,
                                index === items.length - 1 && styles.lastMenuItem
                            ]}
                            onPress={() => {
                                item.onPress();
                                onDismiss();
                            }}
                        >
                            <IconSymbol 
                                name={item.icon} 
                                size={20} 
                                color="#87A987"
                                style={styles.menuIcon} 
                            />
                            <ThemedText style={styles.menuText}>{item.label}</ThemedText>
                        </Pressable>
                    ))}
                </ThemedView>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    menu: {
        position: 'absolute',
        bottom: 100,
        left: '50%',
        marginLeft: -90, // Half of width
        width: 180,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    menuItemPressed: {
        backgroundColor: 'rgba(135, 169, 135, 0.1)',
    },
    lastMenuItem: {
        borderBottomWidth: 0,
    },
    menuIcon: {
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
    },
});
