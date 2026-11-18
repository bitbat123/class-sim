// 只打包需要的 Monaco 模块（完整的 monaco-editor 会让包体到 3.5MB）
// 这里引入 editor.api + 自定义语言，排除内置语言包与额外 worker。
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/browser/coreCommands.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codiconStyles.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/standaloneThemeService.js';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });
export { monaco };
