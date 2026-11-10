import React from 'react';
import { THEMES } from '../themes.js';

/** 主题切换：顶部的小色块按钮，点击即时切换 */
export default function ThemePicker({ themeId, onChange }) {
  return (
    <div className="theme-picker" title="切换主题">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-dot ${themeId === t.id ? 'on' : ''}`}
          style={{ background: t.vars['--accent'] }}
          onClick={() => onChange(t.id)}
          title={t.name}
          aria-label={`切换为${t.name}`}
        />
      ))}
    </div>
  );
}
