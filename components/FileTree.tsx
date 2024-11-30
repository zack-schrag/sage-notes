import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: FileTreeItem[];
}

interface FileTreeProps {
  data: FileTreeItem[];
  onFilePress: (path: string) => void;
  onSelectionChange?: (selectedPaths: string[]) => void;
  onSelectionModeChange?: (isSelectionMode: boolean) => void;
  isSelectionMode?: boolean;
}

interface FileTreeNodeProps {
  item: FileTreeItem;
  onFilePress: (path: string) => void;
  onSelectionChange?: (selectedPaths: string[]) => void;
  level?: number;
  isSelectionMode?: boolean;
  selectedPaths?: Set<string>;
  onLongPress?: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  data, 
  onFilePress,
  onSelectionChange,
  onSelectionModeChange,
  isSelectionMode = false
}) => {
  const [selectedPaths, setSelectedPaths] = useState(new Set<string>());

  // Reset selection when exiting selection mode
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedPaths(new Set());
      onSelectionChange?.([]);
    }
  }, [isSelectionMode]);

  const handleLongPress = (item: FileTreeItem) => {
    onSelectionModeChange?.(true);
    const initialSelection = new Set<string>();
    
    if (item.type === 'dir') {
      // For directories, select all child files
      const childFiles = getAllChildFiles(item);
      childFiles.forEach(path => initialSelection.add(path));
    } else {
      // For files, just select the file
      initialSelection.add(item.path);
    }
    
    setSelectedPaths(initialSelection);
    onSelectionChange?.(Array.from(initialSelection));
  };

  const handleSelectionChange = (paths: string[]) => {
    const newSelection = new Set(selectedPaths);
    paths.forEach(path => {
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
    });
    setSelectedPaths(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  return (
    <View style={styles.container}>
      {data.map((item) => (
        <FileTreeNode
          key={item.path}
          item={item}
          onFilePress={onFilePress}
          onSelectionChange={handleSelectionChange}
          level={0}
          isSelectionMode={isSelectionMode}
          selectedPaths={selectedPaths}
          onLongPress={() => handleLongPress(item)}
        />
      ))}
    </View>
  );
};

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  item, 
  onFilePress, 
  onSelectionChange,
  level = 0,
  isSelectionMode,
  selectedPaths,
  onLongPress
}) => {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = item.type === 'dir';
  const hasChildren = isDirectory && item.children && item.children.length > 0;
  const isSelected = selectedPaths?.has(item.path);

  const getAllChildFiles = (item: FileTreeItem): string[] => {
    let files: string[] = [];
    if (item.type === 'file') {
      files.push(item.path);
    }
    if (item.children) {
      item.children.forEach(child => {
        files = files.concat(getAllChildFiles(child));
      });
    }
    return files;
  };

  const isFullySelected = (): boolean => {
    if (!isDirectory || !selectedPaths) return isSelected || false;
    const childFiles = getAllChildFiles(item);
    return childFiles.length > 0 && childFiles.every(path => selectedPaths.has(path));
  };

  const handlePress = () => {
    if (isSelectionMode && onSelectionChange) {
      // For files, just toggle selection
      if (!isDirectory) {
        onSelectionChange([item.path]);
        return;
      }
      
      // For directories, select/deselect all child files
      const childFiles = getAllChildFiles(item);
      if (isFullySelected()) {
        // If all files are selected, deselect all
        onSelectionChange(childFiles);
      } else {
        // If not all files are selected, select all
        onSelectionChange(childFiles);
        if (!expanded) {
          setExpanded(true);
        }
      }
    } else if (isDirectory) {
      setExpanded(!expanded);
    } else if (onFilePress) {
      onFilePress(item.path);
    }
  };

  const handleCaretPress = (event: GestureResponderEvent) => {
    // Stop event propagation to prevent triggering the parent press handler
    event.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.nodeContainer}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        style={[
          styles.nodeContent,
          { paddingLeft: level * 20 }
        ]}
      >
        {isSelectionMode && (
          <Ionicons
            name={isFullySelected() ? 'checkbox' : 'square-outline'}
            size={20}
            color="#666"
            style={styles.checkbox}
          />
        )}
        {isDirectory && (
          <Pressable onPress={handleCaretPress}>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color="#666"
              style={styles.icon}
            />
          </Pressable>
        )}
        {!isDirectory && (
          <Ionicons
            name="document-text-outline"
            size={20}
            color="#87A987"
            style={styles.icon}
          />
        )}
        <ThemedText style={styles.nodeName}>{item.name}</ThemedText>
      </Pressable>
      
      {hasChildren && expanded && (
        <View style={styles.childrenContainer}>
          {item.children.map((child) => (
            <FileTreeNode
              key={child.path}
              item={child}
              onFilePress={onFilePress}
              onSelectionChange={onSelectionChange}
              level={level + 1}
              isSelectionMode={isSelectionMode}
              selectedPaths={selectedPaths}
              onLongPress={onLongPress}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 10,
  },
  nodeContainer: {
    width: '100%',
  },
  nodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  childrenContainer: {
    width: '100%',
    marginLeft: 32,
  },
  icon: {
    marginRight: 12,
    width: 20,
    opacity: 0.6,
  },
  checkbox: {
    marginRight: 8,
    width: 20,
    opacity: 0.6,
  },
  nodeName: {
    flex: 1,
    fontSize: 15,
    color: '#e0e0e0',
    fontWeight: '400',
  },
});
