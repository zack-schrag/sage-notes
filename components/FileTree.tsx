import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
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
  onSelectionChange 
}) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(new Set<string>());

  const handleLongPress = () => {
    setIsSelectionMode(true);
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

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedPaths(new Set());
    onSelectionChange?.([]);
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
          onLongPress={handleLongPress}
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

  const getAllChildPaths = (item: FileTreeItem): string[] => {
    let paths = [item.path];
    if (item.children) {
      item.children.forEach(child => {
        paths = paths.concat(getAllChildPaths(child));
      });
    }
    return paths;
  };

  const handlePress = () => {
    if (isSelectionMode && onSelectionChange) {
      const paths = isDirectory ? getAllChildPaths(item) : [item.path];
      onSelectionChange(paths);
    } else if (isDirectory) {
      setExpanded(!expanded);
    } else if (onFilePress) {
      onFilePress(item.path);
    }
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
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={20}
            color="#666"
            style={styles.checkbox}
          />
        )}
        {isDirectory && (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color="#666"
            style={styles.icon}
          />
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
