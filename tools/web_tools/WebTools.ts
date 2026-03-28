/**
 * 网络工具
 */

import { fetch } from 'undici';

export class WebTools {
  private readonly MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly REQUEST_TIMEOUT = 10000; // 10秒

  // URL黑名单
  private readonly BLACKLISTED_DOMAINS = new Set([
    'localhost',
    '127.0.0.1',
    '192.168.',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.'
  ]);

  /**
   * 网络搜索（使用 DuckDuckGo）
   */
  async webSearch(query: string, limit: number = 5): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
  }>> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url, {
        timeout: this.REQUEST_TIMEOUT
      });

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // 解析结果
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
      }> = [];

      // DuckDuckGo 的即时答案
      if (data.Abstract) {
        results.push({
          title: data.Heading || '即时答案',
          url: data.AbstractURL || '',
          snippet: data.Abstract
        });
      }

      // 相关主题
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, limit - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text || '',
              url: topic.FirstURL,
              snippet: ''
            });
          }
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      console.error('网络搜索失败:', error);
      // 返回模拟结果用于演示
      return [{
        title: '搜索结果（模拟）',
        url: 'https://example.com',
        snippet: '这是一个模拟的搜索结果。实际使用时需要配置搜索引擎API。'
      }];
    }
  }

  /**
   * 获取URL内容
   */
  async fetchUrl(url: string): Promise<string> {
    this.validateUrl(url);

    try {
      const response = await fetch(url, {
        timeout: this.REQUEST_TIMEOUT
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.statusText}`);
      }

      // 检查内容大小
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_CONTENT_SIZE) {
        throw new Error(`内容过大: ${contentLength} bytes`);
      }

      const content = await response.text();
      
      // 检查实际大小
      if (content.length > this.MAX_CONTENT_SIZE) {
        throw new Error(`内容过大: ${content.length} bytes`);
      }

      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`获取URL内容失败: ${error.message}`);
      }
      throw new Error('获取URL内容失败: 未知错误');
    }
  }

  /**
   * 验证URL
   */
  private validateUrl(url: string): void {
    try {
      const urlObj = new URL(url);

      // 检查协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('仅支持 HTTP 和 HTTPS 协议');
      }

      // 检查域名黑名单
      const hostname = urlObj.hostname.toLowerCase();
      for (const blacklisted of this.BLACKLISTED_DOMAINS) {
        if (hostname === blacklisted || hostname.startsWith(blacklisted)) {
          throw new Error(`不允许访问的域名: ${hostname}`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`URL格式错误: ${error.message}`);
      }
      throw new Error('URL格式错误');
    }
  }

  /**
   * 添加黑名单域名
   */
  addBlacklistedDomain(domain: string): void {
    this.BLACKLISTED_DOMAINS.add(domain.toLowerCase());
  }

  /**
   * 移除黑名单域名
   */
  removeBlacklistedDomain(domain: string): void {
    this.BLACKLISTED_DOMAINS.delete(domain.toLowerCase());
  }
}

// 导出单例
export const webTools = new WebTools();
