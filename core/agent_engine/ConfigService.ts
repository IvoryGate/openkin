import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { readJson, writeJson } from '../../storage/FileStorage.js';
import { CONFIG_FILE } from '../../storage/paths.js';
import type { ApiKeyConfig, AppConfig } from './types/config.js';
import type { LLMClient } from './llm/LLMClient.js';
import { OpenAIClient } from './llm/OpenAIClient.js';
import { AnthropicClient } from './llm/AnthropicClient.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * 从机器指纹派生 32 字节加密密钥（固定且不出进程）
 */
function deriveEncryptionKey(): Buffer {
  const fingerprint = `${hostname()}-${userInfo().username}-openkin-v1`;
  return createHash('sha256').update(fingerprint).digest();
}

const ENCRYPTION_KEY = deriveEncryptionKey();

export class ConfigService {
  /** AES-256-GCM 加密，返回 hex 字符串 */
  encrypt(text: string): string {
    if (!text) return '';
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // 格式：iv(12) + tag(16) + ciphertext，全部 hex 拼接
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  /** AES-256-GCM 解密 */
  decrypt(encryptedHex: string): string {
    if (!encryptedHex) return '';
    const buf = Buffer.from(encryptedHex, 'hex');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  /** 读取应用配置（原始，含加密 key） */
  readConfig(): AppConfig {
    const cfg = readJson<AppConfig>(CONFIG_FILE);
    if (!cfg) {
      return {
        version: '1.0',
        initialized: false,
        active_agent_id: null,
        api_keys: { openai: '', anthropic: '', custom_endpoint: '' },
        ui: { theme: 'dark', language: 'zh-CN' },
      };
    }
    return cfg;
  }

  /** 保存应用配置 */
  writeConfig(config: AppConfig): void {
    writeJson(CONFIG_FILE, config);
  }

  /** 读取已解密的 API Keys */
  async getApiKeys(): Promise<ApiKeyConfig> {
    const cfg = this.readConfig();
    return {
      openai: cfg.api_keys.openai ? this.decrypt(cfg.api_keys.openai) : '',
      anthropic: cfg.api_keys.anthropic ? this.decrypt(cfg.api_keys.anthropic) : '',
      customEndpoint: cfg.api_keys.custom_endpoint || '',
      customModel: cfg.api_keys.custom_model || '',
    };
  }

  /** 保存加密后的 API Keys */
  async saveApiKeys(keys: ApiKeyConfig): Promise<void> {
    const cfg = this.readConfig();
    cfg.api_keys = {
      openai: keys.openai ? this.encrypt(keys.openai) : '',
      anthropic: keys.anthropic ? this.encrypt(keys.anthropic) : '',
      custom_endpoint: keys.customEndpoint || '',
      custom_model: keys.customModel || '',
    };
    this.writeConfig(cfg);
  }

  /** 标记初始化完成 */
  async markInitialized(activeAgentId: string): Promise<void> {
    const cfg = this.readConfig();
    cfg.initialized = true;
    cfg.active_agent_id = activeAgentId;
    this.writeConfig(cfg);
  }

  /** 是否已完成初始化 */
  isInitialized(): boolean {
    return this.readConfig().initialized;
  }

  /**
   * 根据当前配置返回可用的 LLM 客户端
   * 优先级：openai > anthropic > customEndpoint
   */
  async getLLMClient(): Promise<LLMClient> {
    const keys = await this.getApiKeys();
    // 自定义端点：OpenAI 兼容协议，apiKey 用已配置的 openai key，否则 fallback 为 'none'
    if (keys.customEndpoint) {
      const model = keys.customModel || 'LongCat-Flash-Chat';
      return new OpenAIClient(keys.openai || 'none', model, keys.customEndpoint);
    }
    if (keys.openai) {
      return new OpenAIClient(keys.openai);
    }
    if (keys.anthropic) {
      return new AnthropicClient(keys.anthropic);
    }
    throw new Error('No LLM API key configured');
  }
}
