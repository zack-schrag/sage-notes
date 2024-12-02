import { StyleSheet, Platform, Pressable, View, TextInput, SafeAreaView } from 'react-native';
import React from 'react';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { cloneRepository, removeRepository } from '@/utils/fileSystem';
import { saveToken, getToken, removeToken, saveRepoUrl, getRepoUrl, removeRepoUrl } from '@/utils/tokenStorage';
import { setRepoInfo } from '@/utils/githubSync';
import { parseRepoUrl } from '@/utils/githubUtils';
import { initializeTracking } from '@/utils/fileTracker';

export default function SettingsScreen() {
  const [isCloning, setIsCloning] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [githubToken, setGithubToken] = React.useState('');
  const [showToken, setShowToken] = React.useState(false);
  const [repoUrl, setRepoUrl] = React.useState('');

  // Load token and repo URL on component mount
  React.useEffect(() => {
    const loadData = async () => {
      const savedToken = await getToken();
      const savedRepoUrl = await getRepoUrl();
      if (savedToken) {
        setGithubToken(savedToken);
      }
      if (savedRepoUrl) {
        setRepoUrl(savedRepoUrl);
      }
    };
    loadData();
  }, []);

  const handleCloneRepo = async () => {
    if (!githubToken.trim()) {
      alert('Please enter your GitHub token');
      return;
    }

    if (!repoUrl.trim()) {
      alert('Please enter the GitHub repository URL');
      return;
    }

    try {
      setIsCloning(true);
      const repoInfo = parseRepoUrl(repoUrl);
      if (!repoInfo) {
        throw new Error('Invalid repository URL');
      }

      setRepoInfo(repoInfo.owner, repoInfo.name);
      await saveRepoUrl(repoUrl);
      await saveToken(githubToken);
      await cloneRepository(repoUrl, githubToken);
    } catch (error) {
      console.error('Error in handleCloneRepo:', error);
      alert('Failed to clone repository');
    } finally {
      setIsCloning(false);
    }
  };

  const handleRemoveRepo = async () => {
    try {
      setIsRemoving(true);
      await removeRepository();
      await removeToken();
      await removeRepoUrl();
      setGithubToken('');
      setRepoUrl('');
    } catch (error) {
      console.error('Error in handleRemoveRepo:', error);
      alert('Failed to remove repository');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Repository URL</ThemedText>
            <TextInput
              style={[styles.input, { color: '#e0e0e0' }]}
              placeholder="e.g., https://github.com/username/repo"
              placeholderTextColor="#666"
              value={repoUrl}
              onChangeText={setRepoUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>GitHub Personal Access Token</ThemedText>
            <View style={styles.tokenInputContainer}>
              <TextInput
                style={[styles.input, styles.tokenInput, { color: '#e0e0e0' }]}
                placeholder="Enter your GitHub PAT"
                placeholderTextColor="#666"
                value={githubToken}
                onChangeText={setGithubToken}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowToken(!showToken)} style={styles.eyeButton}>
                <IconSymbol name={showToken ? "eye.slash" : "eye"} size={20} color="#87A987" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable 
            onPress={handleCloneRepo} 
            disabled={isCloning}
            style={styles.actionButton}
          >
            <IconSymbol 
              name="arrow.down.circle" 
              size={32} 
              color="#87A987" 
            />
            <ThemedText style={styles.actionText}>
              {isCloning ? 'Cloning...' : 'Clone Repo'}
            </ThemedText>
          </Pressable>

          <Pressable 
            onPress={handleRemoveRepo}
            disabled={isRemoving}
            style={styles.actionButton}
          >
            <IconSymbol 
              name="trash" 
              size={32} 
              color="#dc2626" 
            />
            <ThemedText style={[styles.actionText, styles.deleteText]}>
              {isRemoving ? 'Removing...' : 'Remove Repo'}
            </ThemedText>
          </Pressable>
        </View>
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
    paddingHorizontal: 30,
    paddingTop: Platform.select({
      ios: 20,
      android: 60,
    }),
    paddingBottom: Platform.select({
      ios: 80,
      android: 40,
    }),
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    fontSize: 16,
  },
  tokenInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenInput: {
    flex: 1,
  },
  eyeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 20,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    minWidth: 120,
  },
  actionText: {
    fontSize: 14,
    marginTop: 8,
    color: '#87A987',
    fontWeight: '500',
  },
  deleteText: {
    color: '#dc2626',
  },
});
