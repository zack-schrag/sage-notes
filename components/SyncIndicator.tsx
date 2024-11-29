import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

interface SyncIndicatorProps {
    isVisible: boolean;
}

export function SyncIndicator({ isVisible }: SyncIndicatorProps) {
    if (!isVisible) return null;

    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color="#666" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginLeft: 12,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
