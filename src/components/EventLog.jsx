import React, { useEffect, useRef } from 'react';

const ICON = {
  week: '📅', action: '🎮', exam: '📊', event: '🎲', relief: '🌤', warn: '⚠️', danger: '💥', info: '💬',
};

/**
 * 日志面板：
 * - 随机事件以「全屏弹窗」形式展示在日志上方（点确认后消失）
 * - 日志中的考试条目可点击，打开全屏成绩弹窗
 */
export default function EventLog({ state, onDismissEvent, onShowExam }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.log.length]);

  return (
    <div className="card event-log">
      <div className="ap-head">
        <h3>📜 日志</h3>
      </div>
      <div className="log-list" ref={ref}>
        {state.log.map((l, i) => (
          <div
            key={i}
            className={`log-item t-${l.type} ${l.exam ? 'clickable' : ''}`}
            onClick={l.exam ? () => onShowExam(l.exam) : undefined}
            title={l.exam ? '点击查看全屏成绩' : undefined}
          >
            <span className="log-w">W{l.w}</span>
            <span>{ICON[l.type] || '•'} {l.text}</span>
            {l.exam && <span className="log-go">查看 ›</span>}
          </div>
        ))}
      </div>

      {state.event && (
        <div className="event-overlay">
          <div className="event-modal card">
            <div className="event-modal-head">
              <span className="ev-week">第 {state.event[0].week} 周 · 随机事件</span>
            </div>
            {state.event.map((ev, i) => (
              <div key={i} className={`event-banner ${ev.good ? 'good' : 'bad'}`}>
                <span className="ev-icon">{ev.icon}</span>
                <div className="ev-body">
                  <b>{ev.title}</b>
                  <div className="muted">{ev.text}</div>
                </div>
              </div>
            ))}
            <button className="btn-primary big" onClick={onDismissEvent}>✅ 确认</button>
          </div>
        </div>
      )}
    </div>
  );
}
