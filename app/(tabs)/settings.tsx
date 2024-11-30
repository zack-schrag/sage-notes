import { StyleSheet, Platform, Pressable, View, TextInput, SafeAreaView } from 'react-native';
import React from 'react';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { cloneRepository, removeRepository } from '@/utils/fileSystem';
import { saveToken, getToken, removeToken, saveRepoUrl, getRepoUrl, removeRepoUrl } from '@/utils/tokenStorage';
import { setRepoInfo } from '@/utils/githubSync';

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

  const parseRepoUrl = (url: string): { owner: string; name: string } | null => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== 'github.com') return null;
      
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      
      return {
        owner: parts[0],
        name: parts[1]
      };
    } catch {
      return null;
    }
  };

  const handleCloneRepo = async () => {
    if (!githubToken.trim()) {
      alert('Please enter your GitHub token');
      return;
    }

    if (!repoUrl.trim()) {
      alert('Please enter the GitHub repository URL');
      return;
    }

    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) {
      alert('Invalid GitHub repository URL');
      return;
    }

    try {
      setIsCloning(true);
      await saveToken(githubToken);
      await saveRepoUrl(repoUrl);
      setRepoInfo(repoInfo.owner, repoInfo.name);
      await cloneRepository(githubToken);
    } catch (error) {
      console.error('Error in handleCloneRepo:', error);
      alert('Failed to clone repository. Please check your token and try again.');
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
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="GitHub Repository URL"
            placeholderTextColor="#666"
            value={repoUrl}
            onChangeText={setRepoUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="GitHub Personal Access Token"
            placeholderTextColor="#666"
            value={githubToken}
            onChangeText={setGithubToken}
            secureTextEntry={!showToken}
          />
          <Pressable
            onPress={() => setShowToken(!showToken)}
            style={styles.iconButton}
          >
            <IconSymbol 
              name={showToken ? "eye.slash" : "eye"} 
              size={20} 
              color="#87A987" 
            />
          </Pressable>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable
            onPress={handleCloneRepo}
            style={styles.iconButton}
            disabled={isCloning}
          >
            <IconSymbol 
              name="square.and.arrow.down" 
              size={24} 
              color="#87A987" 
            />
          </Pressable>

          <Pressable
            onPress={handleRemoveRepo}
            style={styles.iconButton}
            disabled={isRemoving}
          >
            <IconSymbol 
              name="trash" 
              size={24} 
              color="#dc2626" 
            />
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
    padding: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#e0e0e0',
    backgroundColor: '#1a1a1a',
    fontSize: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  iconText: {
    fontSize: 12,
    marginTop: 4,
    color: '#87A987',
  },
});
