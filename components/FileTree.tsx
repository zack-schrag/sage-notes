import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeItem[];
}

interface FileTreeProps {
  data: FileTreeItem[];
  onFilePress?: (path: string) => void;
  level?: number;
}

interface FileTreeNodeProps extends FileTreeProps {
  item: FileTreeItem;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ item, onFilePress, level = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = item.type === 'dir';
  const hasChildren = isDirectory && item.children && item.children.length > 0;

  const handlePress = () => {
    if (isDirectory) {
      setExpanded(!expanded);
    } else if (onFilePress) {
      onFilePress(item.path);
    }
  };

  return (
    <View style={styles.nodeContainer}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.nodeContent,
          { paddingLeft: level * 20 }
        ]}
      >
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
            color="#666"
            style={styles.icon}
          />
        )}
        <ThemedText style={styles.nodeName}>{item.name}</ThemedText>
      </Pressable>
      
      {hasChildren && expanded && (
        <View style={styles.childrenContainer}>
          {item.children.map((child, index) => (
            <FileTreeNode
              key={child.path}
              item={child}
              onFilePress={onFilePress}
              level={level + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ data, onFilePress }) => {
  return (
    <View style={styles.container}>
      {data.map((item) => (
        <FileTreeNode
          key={item.path}
          item={item}
          onFilePress={onFilePress}
          level={0}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nodeContainer: {
    width: '100%',
  },
  nodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 16,
  },
  childrenContainer: {
    width: '100%',
  },
  icon: {
    marginRight: 8,
    width: 20,
  },
  nodeName: {
    flex: 1,
  },
});
