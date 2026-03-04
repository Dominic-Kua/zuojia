/**
 * Local snapshot backup functionality
 * Creates filesystem copies of novel state for local backup/restore
 */

import fs from 'fs/promises';
import path from 'path';
import { createError } from '../util/error.js';

/**
 * Sanitize a label for use in directory names
 * @param {string} label - User-provided label
 * @returns {string} Sanitized label safe for filesystem
 */
function sanitizeLabel(label) {
  if (!label || !label.trim()) return '';
  return label
    .trim()
    .replace(/\.\./g, '') // Remove path traversal patterns
    .replace(/[/\\:*?"<>|]/g, '-') // Replace invalid chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
    .substring(0, 50); // Limit length
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {Promise<number>} Number of files copied
 */
async function copyDirectory(src, dest) {
  let fileCount = 0;
  
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        // Skip .git directory
        if (entry.name === '.git') continue;
        fileCount += await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
        fileCount++;
      }
    }
    
    return fileCount;
  } catch (err) {
    throw new Error(`Failed to copy directory ${src}: ${err.message}`);
  }
}

/**
 * Get total size of a directory in bytes
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Size in bytes
 */
async function getDirectorySize(dirPath) {
  let size = 0;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += await getDirectorySize(entryPath);
      } else {
        const stats = await fs.stat(entryPath);
        size += stats.size;
      }
    }
    
    return size;
  } catch (err) {
    return 0;
  }
}

/**
 * Create a snapshot backup of the novel
 * @param {string} novelPath - Path to the novel directory
 * @param {string|null} label - Optional label for the snapshot
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function createSnapshot(novelPath, label = null) {
  try {
    // Validate novel path
    try {
      await fs.access(novelPath);
    } catch {
      return createError(
        'INVALID_NOVEL_PATH',
        'Novel path does not exist',
        `Ensure the path "${novelPath}" exists and is a valid novel directory`
      );
    }
    
    // Generate timestamp and backup directory name
    const timestamp = Date.now();
    const sanitized = sanitizeLabel(label);
    const backupDirName = sanitized 
      ? `${timestamp}-${sanitized}` 
      : `${timestamp}`;
    
    const backupsDir = path.join(novelPath, 'meta', 'backups');
    const backupPath = path.join(backupsDir, backupDirName);
    
    // Ensure backups directory exists
    await fs.mkdir(backupsDir, { recursive: true });
    
    // Create the backup directory
    await fs.mkdir(backupPath, { recursive: true });
    
    // Copy manuscript, wiki, and meta directories
    let totalFiles = 0;
    const directories = ['manuscript', 'wiki', 'meta'];
    
    for (const dir of directories) {
      const srcDir = path.join(novelPath, dir);
      const destDir = path.join(backupPath, dir);
      
      try {
        await fs.access(srcDir);
        // Skip backups directory itself to avoid recursion
        if (dir === 'meta') {
          // Copy meta files but skip backups subdirectory
          await fs.mkdir(destDir, { recursive: true });
          const entries = await fs.readdir(srcDir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.name === 'backups') continue; // Skip backups folder
            
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            
            if (entry.isDirectory()) {
              totalFiles += await copyDirectory(srcPath, destPath);
            } else {
              await fs.copyFile(srcPath, destPath);
              totalFiles++;
            }
          }
        } else {
          totalFiles += await copyDirectory(srcDir, destDir);
        }
      } catch (err) {
        // Directory doesn't exist, skip
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }
    
    // Get backup size before creating manifest (for caching)
    const size = await getDirectorySize(backupPath);
    
    // Create snapshot manifest
    const manifest = {
      timestamp,
      label: label || null,
      novelPath,
      files: totalFiles,
      size, // Cache size in manifest
      created: new Date(timestamp).toISOString(),
    };
    
    const manifestPath = path.join(backupPath, 'snapshot-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    
    return {
      status: 'ok',
      data: {
        timestamp,
        label: label || null,
        path: backupPath,
        files: totalFiles,
        size,
      },
    };
  } catch (err) {
    console.error('Failed to create snapshot:', err);
    return createError(
      'SNAPSHOT_CREATE_FAILED',
      'Failed to create snapshot',
      'Check file permissions and disk space',
      { error: err.message }
    );
  }
}

/**
 * List all snapshots for a novel
 * @param {string} novelPath - Path to the novel directory
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function listSnapshots(novelPath) {
  try {
    // Validate novel path
    try {
      await fs.access(novelPath);
    } catch {
      return createError(
        'INVALID_NOVEL_PATH',
        'Novel path does not exist',
        `Ensure the path "${novelPath}" exists and is a valid novel directory`
      );
    }
    
    const backupsDir = path.join(novelPath, 'meta', 'backups');
    
    // Check if backups directory exists
    try {
      await fs.access(backupsDir);
    } catch {
      // No backups directory means no snapshots
      return {
        status: 'ok',
        data: {
          snapshots: [],
        },
      };
    }
    
    // Read all backup directories
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const snapshots = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const backupPath = path.join(backupsDir, entry.name);
      const manifestPath = path.join(backupPath, 'snapshot-manifest.json');
      
      try {
        // Read manifest
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        
        // Use cached size from manifest if available, otherwise calculate
        const size = manifest.size || await getDirectorySize(backupPath);
        
        snapshots.push({
          timestamp: manifest.timestamp,
          label: manifest.label,
          path: backupPath,
          files: manifest.files,
          size,
          created: manifest.created,
        });
      } catch (err) {
        // Skip backups with invalid manifests
        console.warn(`Skipping backup ${entry.name}: ${err.message}`);
      }
    }
    
    // Sort by timestamp descending (newest first)
    snapshots.sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      status: 'ok',
      data: {
        snapshots,
      },
    };
  } catch (err) {
    console.error('Failed to list snapshots:', err);
    return createError(
      'SNAPSHOT_LIST_FAILED',
      'Failed to list snapshots',
      'Check file permissions',
      { error: err.message }
    );
  }
}

/**
 * Delete a snapshot
 * @param {string} novelPath - Path to the novel directory
 * @param {number} timestamp - Timestamp of the snapshot to delete
 * @returns {Promise<{status: string, data?: object, error?: object}>}
 */
export async function deleteSnapshot(novelPath, timestamp) {
  try {
    // Validate novel path
    try {
      await fs.access(novelPath);
    } catch {
      return createError(
        'INVALID_NOVEL_PATH',
        'Novel path does not exist',
        `Ensure the path "${novelPath}" exists and is a valid novel directory`
      );
    }
    
    const backupsDir = path.join(novelPath, 'meta', 'backups');
    
    // Check if backups directory exists
    try {
      await fs.access(backupsDir);
    } catch {
      return createError(
        'SNAPSHOT_NOT_FOUND',
        'Snapshot not found',
        `No snapshot with timestamp ${timestamp} exists`
      );
    }
    
    // Find the backup directory matching the timestamp
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    let backupDir = null;
    
    const timestampStr = timestamp.toString();
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      // Match directory name exactly to the timestamp, or with a hyphen separator
      if (entry.name === timestampStr || entry.name.startsWith(`${timestampStr}-`)) {
        backupDir = path.join(backupsDir, entry.name);
        break;
      }
    }
    
    if (!backupDir) {
      return createError(
        'SNAPSHOT_NOT_FOUND',
        'Snapshot not found',
        `No snapshot with timestamp ${timestamp} exists`
      );
    }
    
    // Delete the backup directory
    await fs.rm(backupDir, { recursive: true, force: true });
    
    return {
      status: 'ok',
      data: {
        timestamp,
        deleted: true,
      },
    };
  } catch (err) {
    console.error('Failed to delete snapshot:', err);
    return createError(
      'SNAPSHOT_DELETE_FAILED',
      'Failed to delete snapshot',
      'Check file permissions',
      { error: err.message }
    );
  }
}
