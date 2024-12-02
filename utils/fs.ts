import * as FileSystem from 'expo-file-system';

interface Stats {
    isFile: () => boolean;
    isDirectory: () => boolean;
    size: number;
    mtime: Date;
}

const createStats = (info: FileSystem.FileInfo): Stats => ({
    isFile: () => !info.isDirectory,
    isDirectory: () => info.isDirectory || false,
    size: info.size || 0,
    mtime: new Date(),
});

// Create a filesystem adapter using Expo FileSystem
export const fs = {
    promises: {
        readFile: async (path: string) => {
            return await FileSystem.readAsStringAsync(path);
        },
        writeFile: async (path: string, data: string) => {
            await FileSystem.writeAsStringAsync(path, data);
        },
        unlink: async (path: string) => {
            await FileSystem.deleteAsync(path, { idempotent: true });
        },
        readdir: async (path: string) => {
            return await FileSystem.readDirectoryAsync(path);
        },
        mkdir: async (path: string) => {
            await FileSystem.makeDirectoryAsync(path, { intermediates: true });
        },
        rmdir: async (path: string) => {
            await FileSystem.deleteAsync(path, { idempotent: true });
        },
        stat: async (path: string) => {
            const info = await FileSystem.getInfoAsync(path);
            return createStats(info);
        },
        lstat: async (path: string) => {
            const info = await FileSystem.getInfoAsync(path);
            return createStats(info);
        },
    }
};

// Export individual functions for direct use
export const readFile = fs.promises.readFile;
export const writeFile = fs.promises.writeFile;
export const unlink = fs.promises.unlink;
export const readdir = fs.promises.readdir;
export const mkdir = fs.promises.mkdir;
export const rmdir = fs.promises.rmdir;
export const stat = fs.promises.stat;
export const lstat = fs.promises.lstat;

// Export some additional utilities
export const exists = async (path: string): Promise<boolean> => {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
};

export const documentDirectory = FileSystem.documentDirectory;
