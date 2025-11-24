'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import JSZip from 'jszip';
import { config } from '@/const/config';

interface GameEmulatorProps {
  gameId: string;
  romUrl: string;
  system: string;
}

export default function GameEmulator({ gameId, romUrl, system }: GameEmulatorProps) {
  const t = useTranslations('Emulator');
  const emulatorRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 根据系统类型映射到EmulatorJS支持的系统类型
  const getEmulatorSystem = (system: string): string => {
    const systemMapping: Record<string, string> = {
      'nes': 'nes',
      'snes': 'snes',
      'n64': 'n64',
      'gba': 'gba',
      'gbc': 'gbc',
      'gb': 'gb',
      'genesis': 'segaMD',
      'sega': 'segaMD',
      'segacd': 'segaCD',
      'sega32x': 'sega32x',
      'psx': 'psx',
      'ps1': 'psx',
      'nds': 'nds',
      'arcade': 'arcade',
      'mame': 'arcade',
      'pce': 'pce',
      'pcengine': 'pce',
      'default': 'nes'
    };

    const systemLower = system.toLowerCase();
    return systemMapping[systemLower] || systemMapping.default;
  };

  // 从URL中获取文件名（路由最后一段）
  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  // 从IndexedDB获取ROM数据
  const getRomFromIndexedDB = async (key: string): Promise<ArrayBuffer | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('RomsDatabase', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('roms')) {
          db.createObjectStore('roms');
        }
      };

      request.onerror = () => {
        console.error('Error opening IndexedDB');
        resolve(null);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['roms'], 'readonly');
        const store = transaction.objectStore('roms');
        const getRequest = store.get(key);

        getRequest.onsuccess = () => {
          resolve(getRequest.result);
        };

        getRequest.onerror = () => {
          console.error('Error reading from IndexedDB');
          resolve(null);
        };
      };
    });
  };

  // 将ROM数据存储到IndexedDB
  const storeRomInIndexedDB = async (key: string, data: ArrayBuffer): Promise<boolean> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('RomsDatabase', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('roms')) {
          db.createObjectStore('roms');
        }
      };

      request.onerror = () => {
        console.error('Error opening IndexedDB');
        resolve(false);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['roms'], 'readwrite');
        const store = transaction.objectStore('roms');
        const putRequest = store.put(data, key);

        putRequest.onsuccess = () => {
          resolve(true);
        };

        putRequest.onerror = () => {
          console.error('Error writing to IndexedDB');
          resolve(false);
        };
      };
    });
  };

  // 下载并解压ZIP文件
  const downloadAndExtractZip = async (url: string): Promise<ArrayBuffer | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download ROM: ${response.status} ${response.statusText}`);
      }
      
      const zipData = await response.arrayBuffer();
      
      // 加载JSZip库
      if (typeof window.JSZip === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load JSZip'));
          document.head.appendChild(script);
        });
      }
      
      // 解压ZIP文件
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipData);
      
      // 找到第一个ROM文件
      const romFiles = Object.keys(contents.files).filter(filename => 
        !contents.files[filename].dir && 
        (/\.(nes|sfc|n64|gba|gbc|gb|md|smd|iso|bin|rom)$/i.test(filename))
      );
      
      if (romFiles.length === 0) {
        throw new Error('No ROM file found in the ZIP archive');
      }
      
      // 获取第一个ROM文件的内容
      const romFile = romFiles[0];
      return await contents.files[romFile].async('arraybuffer');
    } catch (error) {
      console.error('Error downloading or extracting ZIP:', error);
      return null;
    }
  };

  // 创建Blob URL
  const createBlobUrl = (data: ArrayBuffer, type: string = 'application/octet-stream'): string => {
    const blob = new Blob([data], { type });
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    if (!romUrl) {
      setError(t('noRomError'));
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let blobUrl: string | null = null;

    const loadEmulator = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. 获取文件名作为存储键
        const fileName = getFileNameFromUrl(romUrl);
        
        // 2. 尝试从IndexedDB获取ROM数据
        let romData = await getRomFromIndexedDB(fileName);
        
        // 3. 如果没有缓存，下载并解压ZIP文件
        if (!romData) {
          console.log('ROM not found in cache, downloading...');
          romData = await downloadAndExtractZip(romUrl);
          
          // 存储到IndexedDB
          if (romData) {
            await storeRomInIndexedDB(fileName, romData);
            console.log('ROM stored in cache');
          }
        } else {
          console.log('ROM loaded from cache');
        }
        
        // 4. 如果获取到ROM数据，创建Blob URL
        if (!romData) {
          throw new Error(t('romExtractionError'));
        }
        
        // 创建Blob URL
        blobUrl = createBlobUrl(romData);
        
        if (!mounted) return;

        // 先移除可能已存在的脚本以避免重复
        const existingEmulatorScript = document.querySelector(`script[src="${config.EMULATOR_URL}/src/emulator.js"]`);
        if (existingEmulatorScript) {
          existingEmulatorScript.parentNode?.removeChild(existingEmulatorScript);
        }

        // 5. 配置EmulatorJS
        window.EJS_player = `#emulator-${gameId}`;
        window.EJS_gameUrl = blobUrl;
        window.EJS_core = getEmulatorSystem(system);
        // window.EJS_pathtodata = 'https://cdn.jsdelivr.net/npm/@ttgame/emulatorjs@4.2.2/data/';
        window.EJS_pathtodata = config.EMULATOR_URL;

        window.EJS_startOnLoaded = true;
        
        // 6. 如果需要，加载EmulatorJS脚本
        const existingLoaderScript = document.querySelector(`script[src="${config.EMULATOR_URL}/loader.js"]`);
        if (!existingLoaderScript) {
          // 创建脚本元素
          const scriptElement = document.createElement('script');
          scriptElement.src = config.EMULATOR_URL + '/loader.js';
          scriptElement.async = true;
          scriptElement.id = 'emulator-loader-script';
          
          // 创建Promise等待脚本加载完成
          await new Promise((resolve, reject) => {
            scriptElement.onload = resolve;
            scriptElement.onerror = () => reject(new Error(t('scriptLoadError')));
            document.body.appendChild(scriptElement);
          });
        }

        window.EJS_onGameStart = () => setIsLoading(false);

        // 7. 创建EmulatorJS script
        const emulatorScript = document.querySelector('script[src="' + config.EMULATOR_URL + '/src/emulator.js"]'); 
        if (!emulatorScript) {
          const emulatorScript = document.createElement('script');
          emulatorScript.src = config.EMULATOR_URL + '/src/emulator.js';
          emulatorScript.async = true;
          emulatorScript.id = 'emulator-main-script';
          document.body.appendChild(emulatorScript);
        }
      } catch (err) {
        console.error('Error loading game:', err);
        if (mounted) {
          setError(t('loadError'));
          setIsLoading(false);
        }
      }
    };

    loadEmulator();

    return () => {
      console.log('unmount');
      if(window.EJS_emulator && window.EJS_emulator.ws){
        window.EJS_emulator.ws.close();
      }
      mounted = false;
      // 释放Blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      const loaderScript = document.getElementById('emulator-loader-script') as HTMLScriptElement;
      if (loaderScript) {
        document.body.removeChild(loaderScript);
      }
      
      const emulatorScript1 = document.querySelector('script[src="' + config.EMULATOR_URL + '/src/emulator.js"]'); 
      if (emulatorScript1) {
        emulatorScript1.parentNode?.removeChild(emulatorScript1);
      }
      // 移除脚本
      const emulatorScript = document.getElementById('emulator-main-script');
      if (emulatorScript && emulatorScript.parentNode) {
        emulatorScript.parentNode.removeChild(emulatorScript);
      }
      
    };
  }, [gameId]);

  return (
    <div className="relative w-full aspect-video bg-base-300 rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-base-content">{t('loading')}</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300">
          <div className="text-error text-center p-4">
            <p className="text-xl font-bold mb-2">{t('errorTitle')}</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      <div
        id={`emulator-${gameId}`}
        ref={emulatorRef}
        className="w-full h-full"
      />
    </div>
  );
}

// 添加全局类型定义
declare global {
  interface Window {
    EJS_player: string;
    EJS_gameUrl: string;
    EJS_core: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_onGameStart: () => void;
    EJS_emulator?: {
      stop: () => void;
      gameManager?: {
        saveState: () => Promise<string>;
        loadState: (state: string) => Promise<void>;
        screenshot?: () => Promise<Uint8Array>;
      };
      ws?: {
        close: () => void;
      };
    };
    JSZip: typeof JSZip;
  }
} 