import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';
import { monaco } from '../monacoSetup.js';

/** 代码编辑器：Monaco 本地打包，C++ 风格高亮，带炸弹人方言的自动补全 */
export default function CodeEditor({ value, onChange, readOnly = false, height = '460px' }) {
  const registered = useRef(false);

  const beforeMount = (m) => {
    if (registered.current) return;
    registered.current = true;

    m.languages.register({ id: 'bombcpp' });
    m.languages.setMonarchTokensProvider('bombcpp', {
      keywords: ['int', 'bool', 'void', 'pair', 'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'true', 'false'],
      tokenizer: {
        root: [
          [/bomb::\w+/, 'type.identifier'],
          [/#\w+/, 'keyword.directive'],
          [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          [/\d+/, 'number'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/[{}()[\]]/, '@brackets'],
        ],
        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],
      },
    });
    m.languages.setLanguageConfiguration('bombcpp', {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
      ],
    });

    const K = m.languages.CompletionItemKind;
    m.languages.registerCompletionItemProvider('bombcpp', {
      provideCompletionItems: () => ({
        suggestions: [
          { label: 'bomb::player_pos', detail: 'pair：我的坐标（只读）', kind: K.Variable },
          { label: 'bomb::enemy_pos', detail: 'pair 数组：敌人坐标（只读）', kind: K.Variable },
          { label: 'bomb::bomb_pos', detail: 'pair 数组：炸弹坐标（只读）', kind: K.Variable },
          { label: 'bomb::other_pos', detail: 'pair：对手坐标（只读）', kind: K.Variable },
          { label: 'bomb::wall_pos', detail: 'pair 数组：墙的坐标（只读）', kind: K.Variable },
          { label: 'bomb::player_dir', detail: 'int：方向 0上 1右 2下 3左（可写）', kind: K.Property },
          { label: 'bomb::player_bomb', detail: 'bool：是否放炸弹（可写）', kind: K.Property },
          { label: 'bomb::turn', detail: 'int：当前回合（只读）', kind: K.Variable },
          { label: 'bomb::cooldown', detail: 'int：放炸弹冷却（只读）', kind: K.Variable },
          { label: 'bomb::my_score', detail: 'int：我的分数（只读）', kind: K.Variable },
          { label: 'bomb::can_move(d)', detail: 'bool：方向 d 能否走', kind: K.Function },
          { label: 'bomb::is_wall(x, y)', detail: 'bool：该格是否是墙', kind: K.Function },
          { label: 'bomb::in_danger(p)', detail: 'bool：该格是否在爆炸范围', kind: K.Function },
          { label: 'bomb::can_retreat()', detail: 'bool：是否有安全撤离方向', kind: K.Function },
          { label: 'bomb::dist(a, b)', detail: 'int：两点的曼哈顿距离', kind: K.Function },
        ],
      }),
    });

    m.editor.defineTheme('bomb-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'type.identifier', foreground: '67e8f9' },
        { token: 'keyword', foreground: 'c4b5fd' },
        { token: 'keyword.directive', foreground: 'fbbf24' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      ],
      colors: { 'editor.background': '#0b1020' },
    });
  };

  return (
    <div className="editor-wrap">
      <Editor
        height={height}
        language="bombcpp"
        theme="bomb-dark"
        value={value}
        beforeMount={beforeMount}
        onChange={(v) => onChange?.(v ?? '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          renderWhitespace: 'selection',
        }}
      />
    </div>
  );
}
