import { Image, StyleSheet, Platform, Pressable, Text, View, TextInput } from 'react-native';
import React from 'react';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { cloneRepository, listMarkdownFiles, removeRepository } from '@/utils/fileSystem';
import { saveToken, getToken, removeToken } from '@/utils/tokenStorage';

export default function HomeScreen() {
  const [isCloning, setIsCloning] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [files, setFiles] = React.useState<string[]>([]);
  const [githubToken, setGithubToken] = React.useState('');
  const [showToken, setShowToken] = React.useState(false);

  // Load token on component mount
  React.useEffect(() => {
    const loadToken = async () => {
      const savedToken = await getToken();
      if (savedToken) {
        setGithubToken(savedToken);
      }
    };
    loadToken();
  }, []);

  const handleCloneRepo = async () => {
    if (!githubToken.trim()) {
      alert('Please enter your GitHub token');
      return;
    }

    try {
      setIsCloning(true);
      // Save token before cloning
      await saveToken(githubToken);
      const success = await cloneRepository(githubToken);
      if (success) {
        console.log('Repository setup completed successfully');
        // List files after successful clone
        const markdownFiles = await listMarkdownFiles();
        setFiles(markdownFiles);
      } else {
        console.log('Repository setup failed');
      }
    } catch (error) {
      console.error('Error in handleCloneRepo:', error);
    } finally {
      setIsCloning(false);
    }
  };

  const handleRemoveRepo = async () => {
    try {
      setIsRemoving(true);
      const success = await removeRepository();
      if (success) {
        setFiles([]);
        // Also remove the token when removing the repository
        await removeToken();
        setGithubToken('');
      }
    } catch (error) {
      console.error('Error in handleRemoveRepo:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  // Check for files on component mount
  React.useEffect(() => {
    const checkFiles = async () => {
      const markdownFiles = await listMarkdownFiles();
      setFiles(markdownFiles);
    };
    checkFiles();
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerHeight={300}
      isHeaderFixed={false}
      headerImage={<HelloWave />}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Foo!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12'
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <ThemedText>
          Tap the Explore tab to learn more about what's included in this starter app.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          When you're ready, run{' '}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Repository Setup</ThemedText>
        
        <View style={styles.inputContainer}>
          <ThemedText type="defaultSemiBold">GitHub Token</ThemedText>
          <TextInput
            style={styles.input}
            value={githubToken}
            onChangeText={setGithubToken}
            placeholder="Enter your GitHub token"
            placeholderTextColor="#666"
            secureTextEntry={!showToken}
          />
          <Pressable
            onPress={() => setShowToken(!showToken)}
            style={styles.showHideButton}
          >
            <Text style={styles.showHideButtonText}>
              {showToken ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable 
            style={[styles.button, isCloning && styles.buttonDisabled]}
            onPress={handleCloneRepo}
            disabled={isCloning || isRemoving}
          >
            <Text style={styles.buttonText}>
              {isCloning ? 'Cloning...' : 'Clone Repository'}
            </Text>
          </Pressable>
          
          <Pressable 
            style={[styles.button, styles.removeButton, isRemoving && styles.buttonDisabled]}
            onPress={handleRemoveRepo}
            disabled={isCloning || isRemoving}
          >
            <Text style={styles.buttonText}>
              {isRemoving ? 'Removing...' : 'Remove Repository'}
            </Text>
          </Pressable>
        </View>

        {files.length > 0 && (
          <View style={styles.filesContainer}>
            <ThemedText type="defaultSemiBold" style={styles.filesTitle}>
              Found {files.length} markdown files:
            </ThemedText>
            {files.map((file, index) => (
              <ThemedText key={index} style={styles.fileName}>
                • {file}
              </ThemedText>
            ))}
          </View>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    width: '45%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filesContainer: {
    marginTop: 20,
    width: '100%',
    padding: 10,
  },
  filesTitle: {
    marginBottom: 10,
  },
  fileName: {
    marginLeft: 10,
    marginBottom: 5,
  },
  inputContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    color: '#000',
  },
  showHideButton: {
    position: 'absolute',
    right: 30,
    top: 45,
    padding: 8,
  },
  showHideButtonText: {
    color: '#007AFF',
  },
});
