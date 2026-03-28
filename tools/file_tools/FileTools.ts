/**
 * 文件工具
 */

import { readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export class FileTools {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private allowedDirs: string[] = [];

  constructor() {
    this.allowedDirs = [homedir()];
  }

  /**
   * 读取文件
   */
  async readFile(path: string): Promise<{ content: string; size: number }> {
    const fullPath = this.validatePath(path);
    
    // 检查文件大小
    const stats = await stat(fullPath);
    if (stats.size > this.MAX_FILE_SIZE) {
      throw new Error(`文件过大: ${stats.size} bytes (最大 ${this.MAX_FILE_SIZE} bytes)`);
    }

    const content = await readFile(fullPath, 'utf-8');
    return { content, size: stats.size };
  }

  /**
   * 写入文件
   */
  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.validatePath(path);
    
    // 检查内容大小
    if (content.length > this.MAX_FILE_SIZE) {
      throw new Error(`内容过大: ${content.length} bytes (最大 ${this.MAX_FILE_SIZE} bytes)`);
    }

    await writeFile(fullPath, content, 'utf-8');
  }

  /**
   * 列出目录文件
   */
  async listFiles(dir: string): Promise<string[]> {
    const fullPath = this.validatePath(dir);
    const files = await readdir(fullPath);
    return files;
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    const fullPath = this.validatePath(path);
    await unlink(fullPath);
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean }> {
    const fullPath = this.validatePath(path);
    const stats = await stat(fullPath);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  }

  /**
   * 验证路径
   */
  private validatePath(path: string): string {
    // 解析路径
    let fullPath: string;
    
    if (path.startsWith('~/') || path.startsWith('~\\')) {
      fullPath = join(homedir(), path.slice(2));
    } else if (path.startsWith('/')) {
      fullPath = path;
    } else {
      fullPath = join(process.cwd(), path);
    }

    // 检查是否在允许的目录中
    const normalizedPath = fullPath.toLowerCase();
    const isAllowed = this.allowedDirs.some(dir => 
      normalizedPath.startsWith(dir.toLowerCase())
    );

    if (!isAllowed) {
      throw new Error(`路径不在允许的目录中: ${fullPath}`);
    }

    return fullPath;
  }

  /**
   * 添加允许的目录
   */
  addAllowedDir(dir: string): void {
    this.allowedDirs.push(dir);
  }

  /**
   * 移除允许的目录
   */
  removeAllowedDir(dir: string): void {
    this.allowedDirs = this.allowedDirs.filter(d => d !== dir);
  }
}

// 导出单例
export const fileTools = new FileTools();
