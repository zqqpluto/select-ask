/**
 * 问题处理流程闸门 Hook
 * 强制要求按顺序执行：复现 → 分析 → 解决 → 验证
 * 未完成当前闸门时，attemptNext() 返回 false
 */
import { useRef, useCallback } from 'react';

type Gate = 'reproduce' | 'analyze' | 'fix' | 'verify';

const GATE_ORDER: Gate[] = ['reproduce', 'analyze', 'fix', 'verify'];
const GATE_NAMES: Record<Gate, string> = {
  reproduce: '闸门 1：复现问题',
  analyze: '闸门 2：分析根因',
  fix: '闸门 3：最小修复',
  verify: '闸门 4：验证修复',
};

interface UseProcessGateReturn {
  /** 当前处于哪个闸门 */
  currentGate: Gate;
  /** 闸门名称 */
  gateName: string;
  /** 尝试进入下一闸门。返回 false 说明被拦截 */
  attemptNext: () => boolean;
  /** 直接跳到指定闸门（仅用于循环重试场景：验证失败回退到分析） */
  jumpTo: (gate: Gate) => void;
  /** 重置闸门（新问题时调用） */
  reset: () => void;
  /** 记录当前闸门已完成的确认信息 */
  confirm: (note: string) => void;
}

export function useProcessGate(initialGate: Gate = 'reproduce'): UseProcessGateReturn {
  const currentRef = useRef<Gate>(initialGate);
  const notesRef = useRef<Record<Gate, string | undefined>>({
    reproduce: undefined,
    analyze: undefined,
    fix: undefined,
    verify: undefined,
  });

  const attemptNext = useCallback((): boolean => {
    const idx = GATE_ORDER.indexOf(currentRef.current);
    if (idx >= GATE_ORDER.length - 1) return false;
    const nextGate = GATE_ORDER[idx + 1];
    if (!notesRef.current[currentRef.current]) {
      console.error(
        `[Gate 拦截] 未完成 "${GATE_NAMES[currentRef.current]}" 就尝试进入 "${GATE_NAMES[nextGate]}"。\n` +
        `必须先完成当前闸门并调用 confirm() 记录结果。`
      );
      return false;
    }
    currentRef.current = nextGate;
    return true;
  }, []);

  const jumpTo = useCallback((gate: Gate) => {
    currentRef.current = gate;
  }, []);

  const reset = useCallback(() => {
    currentRef.current = initialGate;
    notesRef.current = {
      reproduce: undefined,
      analyze: undefined,
      fix: undefined,
      verify: undefined,
    };
  }, [initialGate]);

  const confirm = useCallback((note: string) => {
    notesRef.current[currentRef.current] = note;
  }, []);

  return {
    currentGate: currentRef.current,
    gateName: GATE_NAMES[currentRef.current],
    attemptNext,
    jumpTo,
    reset,
    confirm,
  };
}
