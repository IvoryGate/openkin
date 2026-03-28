/**
 * 命令工具
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CommandTools {
  private readonly EXECUTION_TIMEOUT = 30000; // 30秒
  private readonly MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

  // 允许的命令白名单
  private readonly ALLOWED_COMMANDS = new Set([
    'ls', 'dir', 'cat', 'type', 'echo',
    'pwd', 'cd', 'mkdir', 'rmdir',
    'git', 'npm', 'yarn', 'pnpm',
    'node', 'python', 'python3', 'pip',
    'grep', 'find', 'head', 'tail',
    'wc', 'sort', 'uniq'
  ]);

  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }> {
    // 验证命令
    this.validateCommand(command);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.EXECUTION_TIMEOUT,
        maxBuffer: this.MAX_OUTPUT_SIZE
      });

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        code: 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        code: error.code || 1
      };
    }
  }

  /**
   * 验证命令
   */
  private validateCommand(command: string): void {
    // 提取命令名称
    const parts = command.trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();

    // 检查是否在白名单中
    if (!this.ALLOWED_COMMANDS.has(cmdName)) {
      throw new Error(`命令不允许执行: ${cmdName}`);
    }

    // 检查危险操作
    const dangerousPatterns = [
      'rm -rf /',
      'dd if=',
      'mkfs',
      'chmod 777',
      '> /dev/',
      'format',
      'del /f /q'
    ];

    const lowerCommand = command.toLowerCase();
    for (const pattern of dangerousPatterns) {
      if (lowerCommand.includes(pattern)) {
        throw new Error(`命令包含危险操作: ${pattern}`);
      }
    }
  }

  /**
   * 获取允许的命令列表
   */
  getAllowedCommands(): string[] {
    return Array.from(this.ALLOWED_COMMANDS);
  }

  /**
   * 添加允许的命令
   */
  addAllowedCommand(command: string): void {
    this.ALLOWED_COMMANDS.add(command.toLowerCase());
  }

  /**
   * 移除允许的命令
   */
  removeAllowedCommand(command: string): void {
    this.ALLOWED_COMMANDS.delete(command.toLowerCase());
  }
}

// 导出单例
export const commandTools = new CommandTools();
