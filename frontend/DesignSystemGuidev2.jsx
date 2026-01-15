import React, { useState } from 'react';

// Design Token 정의
const tokens = {
  primitives: {
    neutral: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    blue: { 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
    cyan: { 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
    green: { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
    yellow: { 400: '#facc15', 500: '#eab308', 600: '#ca8a04' },
    orange: { 400: '#fb923c', 500: '#f97316', 600: '#ea580c' },
    red: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
    purple: { 400: '#c084fc', 500: '#a855f7', 600: '#9333ea' },
  },
  fonts: {
    family: {
      base: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace"
    },
    size: {
      xs: '11px', sm: '12px', base: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px'
    },
    weight: {
      normal: 400, medium: 500, semibold: 600, bold: 700
    }
  },
  spacing: {
    0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px'
  },
  radius: {
    sm: '4px', md: '6px', lg: '8px', xl: '12px', full: '9999px'
  }
};

const themes = {
  light: {
    name: 'Light Mode',
    layers: {
      base: { color: '#f1f5f9', label: 'App Background', desc: 'Off-White 쿨그레이' },
      panel: { color: '#ffffff', label: 'Panel/Card', desc: '순백색 + Shadow' },
      overlay: { color: 'rgba(255,255,255,0.7)', label: '3D Overlay', desc: 'Glassmorphism' },
    },
    content: {
      primary: '#0f172a',
      secondary: '#334155',
      tertiary: '#64748b',
      muted: '#94a3b8',
      disabled: '#cbd5e1',
      inverse: '#ffffff',
    },
    border: {
      subtle: '#f1f5f9',
      default: '#e2e8f0',
      strong: '#cbd5e1',
      focus: '#3b82f6',
    },
    interactive: {
      primary: {
        normal: '#3b82f6',
        hover: '#2563eb',
        active: '#1d4ed8',
        disabled: '#93c5fd',
      },
      secondary: {
        normal: '#64748b',
        hover: '#475569',
        active: '#334155',
        disabled: '#cbd5e1',
      },
      danger: {
        normal: '#ef4444',
        hover: '#dc2626',
        active: '#b91c1c',
        disabled: '#fca5a5',
      },
      success: {
        normal: '#22c55e',
        hover: '#16a34a',
        active: '#15803d',
        disabled: '#86efac',
      },
    },
    surface: {
      primary: {
        normal: '#f1f5f9',
        hover: '#e2e8f0',
        active: '#cbd5e1',
        disabled: '#f8fafc',
      },
      secondary: {
        normal: '#f8fafc',
        hover: '#f1f5f9',
        active: '#e2e8f0',
        disabled: '#ffffff',
      }
    },
    glass: {
      bg: 'rgba(255, 255, 255, 0.7)',
      blur: '12px',
      border: 'rgba(255, 255, 255, 0.3)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    }
  },
  dark: {
    name: 'Dark Mode',
    layers: {
      base: { color: '#0f172a', label: 'App Background', desc: '깊은 우주색' },
      panel: { color: '#1e293b', label: 'Panel/Card', desc: '구분되는 어둠' },
      overlay: { color: 'rgba(15,23,42,0.75)', label: '3D Overlay', desc: 'Smoke Glass' },
    },
    content: {
      primary: '#f8fafc',
      secondary: '#e2e8f0',
      tertiary: '#94a3b8',
      muted: '#64748b',
      disabled: '#475569',
      inverse: '#0f172a',
    },
    border: {
      subtle: 'rgba(255,255,255,0.05)',
      default: 'rgba(255,255,255,0.1)',
      strong: 'rgba(255,255,255,0.2)',
      focus: '#06b6d4',
    },
    interactive: {
      primary: {
        normal: '#06b6d4',
        hover: '#22d3ee',
        active: '#0891b2',
        disabled: '#164e63',
      },
      secondary: {
        normal: '#94a3b8',
        hover: '#cbd5e1',
        active: '#64748b',
        disabled: '#475569',
      },
      danger: {
        normal: '#f87171',
        hover: '#fca5a5',
        active: '#ef4444',
        disabled: '#7f1d1d',
      },
      success: {
        normal: '#4ade80',
        hover: '#86efac',
        active: '#22c55e',
        disabled: '#14532d',
      },
    },
    surface: {
      primary: {
        normal: '#1e293b',
        hover: 'rgba(255,255,255,0.05)',
        active: 'rgba(255,255,255,0.1)',
        disabled: '#0f172a',
      },
      secondary: {
        normal: 'rgba(255,255,255,0.05)',
        hover: 'rgba(255,255,255,0.08)',
        active: 'rgba(255,255,255,0.12)',
        disabled: 'rgba(255,255,255,0.02)',
      }
    },
    glass: {
      bg: 'rgba(15, 23, 42, 0.75)',
      blur: '12px',
      border: 'rgba(255, 255, 255, 0.1)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    },
    glow: {
      primary: '0 0 20px rgba(6, 182, 212, 0.4)',
      success: '0 0 12px rgba(74, 222, 128, 0.5)',
      error: '0 0 12px rgba(248, 113, 113, 0.5)',
    }
  }
};

// Section Header
const SectionHeader = ({ title, subtitle, theme }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold" style={{ color: theme.content.primary, fontFamily: tokens.fonts.family.base }}>{title}</h2>
    {subtitle && <p className="text-sm mt-1" style={{ color: theme.content.tertiary }}>{subtitle}</p>}
  </div>
);

// State Badge
const StateBadge = ({ state, theme }) => {
  const colors = {
    normal: { bg: theme.interactive.primary.normal, text: '#fff' },
    hover: { bg: theme.interactive.success.normal, text: '#fff' },
    active: { bg: theme.interactive.danger.normal, text: '#fff' },
    disabled: { bg: theme.content.disabled, text: theme.content.muted },
  };
  return (
    <span 
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: colors[state]?.bg, color: colors[state]?.text }}
    >
      {state.toUpperCase()}
    </span>
  );
};

// Main Component
export default function DesignSystemGuide() {
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('layers');
  const theme = isDark ? themes.dark : themes.light;
  const t = tokens.primitives;

  const tabs = [
    { id: 'layers', label: '🎨 Visual Layers' },
    { id: 'typography', label: '📝 Typography' },
    { id: 'colors', label: '🎯 Colors' },
    { id: 'states', label: '🔄 States' },
    { id: 'effects', label: '✨ Effects' },
    { id: 'panel', label: '📦 Panel 예시' },
  ];

  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ 
        backgroundColor: theme.layers.base.color,
        fontFamily: tokens.fonts.family.base
      }}
    >
      {/* Google Fonts */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" 
        rel="stylesheet" 
      />

      {/* Header */}
      <header 
        className="sticky top-0 z-50 px-6 py-4"
        style={{ 
          backgroundColor: theme.glass.bg,
          backdropFilter: `blur(${theme.glass.blur})`,
          borderBottom: `1px solid ${theme.border.default}`
        }}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: theme.content.primary }}>
              SHERLOCK_SKY Design System
            </h1>
            <p className="text-sm" style={{ color: theme.content.tertiary }}>
              Visual Reference Guide v2.0 - {theme.name}
            </p>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{ 
              backgroundColor: theme.interactive.primary.normal,
              color: '#ffffff',
              boxShadow: isDark ? themes.dark.glow.primary : 'none'
            }}
          >
            {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? theme.interactive.primary.normal : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : theme.content.secondary,
                border: activeTab === tab.id ? 'none' : `1px solid ${theme.border.default}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">

        {/* ========================================
            TAB 1: Visual Layers
            ======================================== */}
        {activeTab === 'layers' && (
          <section className="space-y-8">
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Visual Layers (깊이감 구조)" 
                subtitle="Light: Off-White 전략으로 Panel이 떠있는 느낌 / Dark: Deep Space + Glow"
                theme={theme}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(theme.layers).map(([key, layer], idx) => (
                  <div key={key} className="relative">
                    <div 
                      className="h-40 rounded-xl flex flex-col items-center justify-center border-2 transition-all"
                      style={{ 
                        backgroundColor: layer.color,
                        borderColor: theme.border.default,
                        backdropFilter: key === 'overlay' ? `blur(${theme.glass.blur})` : 'none',
                      }}
                    >
                      <div className="text-3xl font-bold mb-2" style={{ color: theme.content.primary }}>
                        Layer {idx + 1}
                      </div>
                      <div className="font-semibold" style={{ color: theme.content.secondary }}>
                        {layer.label}
                      </div>
                    </div>
                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                      <code 
                        className="text-sm block mb-1"
                        style={{ fontFamily: tokens.fonts.family.mono, color: theme.interactive.primary.normal }}
                      >
                        {layer.color}
                      </code>
                      <p className="text-xs" style={{ color: theme.content.muted }}>{layer.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Layer Stack 3D Preview */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>Layer Stack Preview (3D 시뮬레이션 환경)</h3>
                <div 
                  className="relative h-64 rounded-xl overflow-hidden p-4"
                  style={{ 
                    backgroundColor: theme.layers.base.color,
                    background: `linear-gradient(135deg, ${theme.interactive.primary.normal}22 0%, ${theme.interactive.success.normal}22 100%)`
                  }}
                >
                  {/* Simulated 3D Background */}
                  <div className="absolute inset-0 opacity-30">
                    <div className="grid grid-cols-12 h-full">
                      {Array(24).fill(0).map((_, i) => (
                        <div key={i} className="border" style={{ borderColor: theme.border.subtle }} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded" 
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    3D Scene (ThreeJS Canvas)
                  </div>

                  {/* Panel Layer */}
                  <div 
                    className="absolute top-6 left-6 w-48 rounded-lg shadow-xl"
                    style={{ backgroundColor: theme.layers.panel.color }}
                  >
                    <div className="p-3 border-b" style={{ borderColor: theme.border.default }}>
                      <span className="text-sm font-semibold" style={{ color: theme.content.primary }}>Sidebar Panel</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {['View', 'Edit', 'Monitor'].map(item => (
                        <div key={item} className="text-xs py-1" style={{ color: theme.content.secondary }}>{item}</div>
                      ))}
                    </div>
                  </div>

                  {/* Glass Overlay */}
                  <div 
                    className="absolute top-12 right-6 w-64 rounded-xl"
                    style={{
                      backgroundColor: theme.glass.bg,
                      backdropFilter: `blur(${theme.glass.blur})`,
                      border: `1px solid ${theme.glass.border}`,
                      boxShadow: theme.glass.shadow
                    }}
                  >
                    <div className="p-3 border-b" style={{ borderColor: theme.border.default }}>
                      <span className="text-sm font-semibold" style={{ color: theme.interactive.primary.normal }}>Equipment Info</span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs" style={{ color: theme.content.secondary }}>ID</span>
                        <span 
                          className="text-xs font-medium"
                          style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.primary }}
                        >EQ-01-05</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs" style={{ color: theme.content.secondary }}>Status</span>
                        <span className="text-xs font-medium" style={{ color: theme.interactive.success.normal }}>Running</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================
            TAB 2: Typography
            ======================================== */}
        {activeTab === 'typography' && (
          <section className="space-y-8">
            {/* Font Family */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Font Family (폰트 패밀리)" 
                subtitle="Inter: 본문용 / JetBrains Mono: 데이터/ID 표시용"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inter */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.interactive.primary.normal }} />
                    <h3 className="font-semibold" style={{ color: theme.content.primary }}>Inter (Base)</h3>
                  </div>
                  <code 
                    className="text-xs block mb-4 p-2 rounded"
                    style={{ 
                      fontFamily: tokens.fonts.family.mono, 
                      backgroundColor: theme.layers.base.color,
                      color: theme.interactive.primary.normal 
                    }}
                  >
                    --font-family-base: 'Inter', -apple-system, sans-serif;
                  </code>
                  <div className="space-y-2" style={{ fontFamily: tokens.fonts.family.base }}>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: theme.content.primary }}>Equipment Monitor</p>
                    <p style={{ fontSize: '16px', fontWeight: 400, color: theme.content.secondary }}>
                      The quick brown fox jumps over the lazy dog.
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: 400, color: theme.content.tertiary }}>
                      빠른 갈색 여우가 게으른 개를 뛰어넘습니다.
                    </p>
                    <div className="flex gap-4 pt-2">
                      <span style={{ fontSize: '14px' }}>1234567890</span>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>1234567890</span>
                    </div>
                  </div>
                  <p className="text-xs mt-4" style={{ color: theme.content.muted }}>
                    ✓ 본문, 헤딩, 버튼, 라벨에 사용<br/>
                    ✓ 숫자가 튀지 않고 깔끔한 가독성
                  </p>
                </div>

                {/* JetBrains Mono */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.interactive.success.normal }} />
                    <h3 className="font-semibold" style={{ color: theme.content.primary }}>JetBrains Mono (Mono)</h3>
                  </div>
                  <code 
                    className="text-xs block mb-4 p-2 rounded"
                    style={{ 
                      fontFamily: tokens.fonts.family.mono, 
                      backgroundColor: theme.layers.base.color,
                      color: theme.interactive.success.normal 
                    }}
                  >
                    --font-family-mono: 'JetBrains Mono', monospace;
                  </code>
                  <div className="space-y-2" style={{ fontFamily: tokens.fonts.family.mono }}>
                    <p style={{ fontSize: '18px', fontWeight: 500, color: theme.content.primary }}>EQ-01-05</p>
                    <p style={{ fontSize: '14px', fontWeight: 400, color: theme.content.secondary }}>
                      LOT2024011234567890
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <span className="px-2 py-1 rounded" style={{ backgroundColor: theme.layers.base.color, color: theme.content.primary }}>
                        123.456
                      </span>
                      <span className="px-2 py-1 rounded" style={{ backgroundColor: theme.layers.base.color, color: theme.content.primary }}>
                        -45.78°C
                      </span>
                      <span className="px-2 py-1 rounded" style={{ backgroundColor: theme.layers.base.color, color: theme.content.primary }}>
                        99.9%
                      </span>
                    </div>
                    <div className="pt-2" style={{ fontSize: '12px', color: theme.content.tertiary }}>
                      0123456789 OQIL1l
                    </div>
                  </div>
                  <p className="text-xs mt-4" style={{ color: theme.content.muted }}>
                    ✓ 장비 ID, 센서 데이터, 좌표값에 사용<br/>
                    ✓ 고정폭으로 정렬이 깔끔<br/>
                    ✓ 0과 O, 1과 l 구분이 명확
                  </p>
                </div>
              </div>

              {/* Comparison */}
              <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.content.secondary }}>비교: 같은 데이터, 다른 폰트</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded" style={{ backgroundColor: theme.layers.base.color }}>
                    <span className="text-xs block mb-2" style={{ color: theme.content.muted }}>Inter (기본)</span>
                    <div style={{ fontFamily: tokens.fonts.family.base, fontSize: '16px', color: theme.content.primary }}>
                      Equipment: EQ-01-05 | Temp: 123.45°C | Status: 0x8F
                    </div>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: theme.layers.base.color }}>
                    <span className="text-xs block mb-2" style={{ color: theme.content.muted }}>JetBrains Mono (데이터용)</span>
                    <div style={{ fontFamily: tokens.fonts.family.mono, fontSize: '16px', color: theme.content.primary }}>
                      Equipment: EQ-01-05 | Temp: 123.45°C | Status: 0x8F
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Font Size & Weight */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Font Size & Weight Scale" 
                subtitle="일관된 타이포그래피 스케일"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Font Sizes */}
                <div>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>Size Scale</h3>
                  <div className="space-y-3">
                    {Object.entries(tokens.fonts.size).map(([key, size]) => (
                      <div 
                        key={key} 
                        className="flex items-center gap-4 p-3 rounded-lg"
                        style={{ backgroundColor: theme.surface.secondary.normal }}
                      >
                        <code 
                          className="text-xs w-16 px-2 py-1 rounded text-center"
                          style={{ 
                            backgroundColor: theme.interactive.primary.normal, 
                            color: '#fff',
                            fontFamily: tokens.fonts.family.mono 
                          }}
                        >
                          {key}
                        </code>
                        <code 
                          className="text-xs w-12"
                          style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                        >
                          {size}
                        </code>
                        <span style={{ fontSize: size, color: theme.content.primary }}>
                          Sample Text 샘플 12345
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font Weights */}
                <div>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>Weight Scale</h3>
                  <div className="space-y-3">
                    {Object.entries(tokens.fonts.weight).map(([key, weight]) => (
                      <div 
                        key={key} 
                        className="flex items-center gap-4 p-3 rounded-lg"
                        style={{ backgroundColor: theme.surface.secondary.normal }}
                      >
                        <code 
                          className="text-xs w-20 px-2 py-1 rounded text-center"
                          style={{ 
                            backgroundColor: theme.interactive.success.normal, 
                            color: '#fff',
                            fontFamily: tokens.fonts.family.mono 
                          }}
                        >
                          {key}
                        </code>
                        <code 
                          className="text-xs w-10"
                          style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                        >
                          {weight}
                        </code>
                        <span style={{ fontSize: '16px', fontWeight: weight, color: theme.content.primary }}>
                          Weight {weight} 가중치
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Typography Usage Table */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>사용 가이드</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: theme.surface.secondary.normal }}>
                        <th className="text-left p-3 rounded-tl-lg" style={{ color: theme.content.secondary }}>용도</th>
                        <th className="text-left p-3" style={{ color: theme.content.secondary }}>Font</th>
                        <th className="text-left p-3" style={{ color: theme.content.secondary }}>Size</th>
                        <th className="text-left p-3" style={{ color: theme.content.secondary }}>Weight</th>
                        <th className="text-left p-3 rounded-tr-lg" style={{ color: theme.content.secondary }}>Color</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { use: 'Panel Title', font: 'Inter', size: 'xl (20px)', weight: '600', color: 'interactive.primary' },
                        { use: 'Section Header', font: 'Inter', size: 'lg (18px)', weight: '600', color: 'content.primary' },
                        { use: 'Body Text', font: 'Inter', size: 'base (14px)', weight: '400', color: 'content.primary' },
                        { use: 'Label', font: 'Inter', size: 'sm (12px)', weight: '600', color: 'content.secondary' },
                        { use: 'Equipment ID', font: 'JetBrains', size: 'base (14px)', weight: '500', color: 'content.primary' },
                        { use: 'Sensor Data', font: 'JetBrains', size: 'base (14px)', weight: '400', color: 'content.primary' },
                        { use: 'Timestamp', font: 'JetBrains', size: 'xs (11px)', weight: '400', color: 'content.muted' },
                      ].map((row, i) => (
                        <tr 
                          key={i} 
                          style={{ 
                            backgroundColor: i % 2 === 0 ? 'transparent' : theme.surface.secondary.normal,
                            borderBottom: `1px solid ${theme.border.subtle}` 
                          }}
                        >
                          <td className="p-3" style={{ color: theme.content.primary }}>{row.use}</td>
                          <td className="p-3">
                            <code 
                              className="text-xs px-1 rounded"
                              style={{ 
                                backgroundColor: row.font === 'JetBrains' ? theme.interactive.success.normal + '22' : theme.interactive.primary.normal + '22',
                                color: row.font === 'JetBrains' ? theme.interactive.success.normal : theme.interactive.primary.normal,
                                fontFamily: tokens.fonts.family.mono
                              }}
                            >
                              {row.font}
                            </code>
                          </td>
                          <td className="p-3" style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.tertiary }}>{row.size}</td>
                          <td className="p-3" style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.tertiary }}>{row.weight}</td>
                          <td className="p-3" style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.tertiary }}>{row.color}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================
            TAB 3: Colors
            ======================================== */}
        {activeTab === 'colors' && (
          <section className="space-y-8">
            {/* Color Primitives */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Color Primitives (원시 색상)" 
                subtitle="테마 독립적인 전체 팔레트"
                theme={theme}
              />

              {/* Neutral */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.content.secondary }}>Neutral Scale</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(t.neutral).map(([key, color]) => (
                    <div key={key} className="flex flex-col items-center">
                      <div 
                        className="w-14 h-14 rounded-lg border"
                        style={{ backgroundColor: color, borderColor: theme.border.default }}
                      />
                      <span className="text-xs mt-1" style={{ color: theme.content.muted }}>{key}</span>
                      <code 
                        className="text-xs"
                        style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.tertiary }}
                      >
                        {color}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Colors */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {['blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'purple'].map(colorName => (
                  <div key={colorName}>
                    <h3 className="text-sm font-semibold mb-2 capitalize" style={{ color: theme.content.secondary }}>{colorName}</h3>
                    <div className="space-y-1">
                      {Object.entries(t[colorName]).map(([key, color]) => (
                        <div key={key} className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <span className="text-xs" style={{ color: theme.content.muted }}>{key}</span>
                            <code 
                              className="text-xs block"
                              style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.tertiary }}
                            >
                              {color}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Semantic Colors */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title={`Semantic Colors (${theme.name})`}
                subtitle="테마별 의미론적 색상 매핑"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Content */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: theme.content.secondary }}>Content (텍스트)</h3>
                  <div className="space-y-2">
                    {Object.entries(theme.content).map(([key, color]) => (
                      <div 
                        key={key} 
                        className="flex items-center gap-3 p-2 rounded"
                        style={{ backgroundColor: theme.surface.secondary.normal }}
                      >
                        <div 
                          className="w-10 h-10 rounded flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: color, color: key === 'inverse' ? theme.content.primary : theme.content.inverse }}
                        >
                          Aa
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: theme.content.primary }}>{key}</div>
                          <code 
                            className="text-xs"
                            style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                          >
                            {color}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Border */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: theme.content.secondary }}>Border (테두리)</h3>
                  <div className="space-y-2">
                    {Object.entries(theme.border).map(([key, color]) => (
                      <div 
                        key={key} 
                        className="flex items-center gap-3 p-2 rounded"
                        style={{ backgroundColor: theme.surface.secondary.normal }}
                      >
                        <div 
                          className="w-10 h-10 rounded"
                          style={{ border: `3px solid ${color}`, backgroundColor: 'transparent' }}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: theme.content.primary }}>{key}</div>
                          <code 
                            className="text-xs"
                            style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                          >
                            {color}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: theme.content.secondary }}>Status (장비 상태)</h3>
                  <div className="space-y-2">
                    {[
                      { name: 'Running', color: theme.interactive.success.normal, glow: true },
                      { name: 'Idle', color: isDark ? '#facc15' : '#eab308', glow: false },
                      { name: 'Stop', color: isDark ? '#fb923c' : '#f97316', glow: false },
                      { name: 'Error', color: theme.interactive.danger.normal, glow: true },
                      { name: 'Offline', color: theme.content.muted, glow: false },
                    ].map(status => (
                      <div 
                        key={status.name}
                        className="flex items-center gap-3 p-2 rounded"
                        style={{ backgroundColor: theme.surface.secondary.normal }}
                      >
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ 
                            backgroundColor: status.color,
                            boxShadow: isDark && status.glow ? `0 0 12px ${status.color}` : 'none'
                          }}
                        />
                        <span className="text-sm font-medium flex-1" style={{ color: theme.content.primary }}>
                          {status.name}
                        </span>
                        <code 
                          className="text-xs"
                          style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                        >
                          {status.color}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================
            TAB 4: States (Hover/Active/Disabled)
            ======================================== */}
        {activeTab === 'states' && (
          <section className="space-y-8">
            {/* Interactive States */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Interactive States (버튼 상태)" 
                subtitle="Normal → Hover → Active → Disabled"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['primary', 'secondary', 'danger', 'success'].map(variant => (
                  <div key={variant} className="p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                    <h3 className="text-sm font-semibold mb-4 capitalize" style={{ color: theme.content.secondary }}>
                      {variant}
                    </h3>
                    <div className="space-y-3">
                      {['normal', 'hover', 'active', 'disabled'].map(state => (
                        <div key={state} className="flex items-center gap-3">
                          <div 
                            className="w-24 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all"
                            style={{ 
                              backgroundColor: theme.interactive[variant][state],
                              color: state === 'disabled' ? theme.content.disabled : '#ffffff',
                              cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
                              opacity: state === 'disabled' ? 0.6 : 1,
                              boxShadow: isDark && state === 'hover' && variant === 'primary' ? themes.dark.glow.primary : 'none'
                            }}
                          >
                            Button
                          </div>
                          <div className="flex-1">
                            <StateBadge state={state} theme={theme} />
                            <code 
                              className="text-xs block mt-1"
                              style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                            >
                              {theme.interactive[variant][state]}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Button Examples */}
              <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>실제 버튼 예시 (Hover해보세요)</h3>
                <div className="flex flex-wrap gap-4">
                  {['primary', 'secondary', 'danger', 'success'].map(variant => (
                    <button
                      key={variant}
                      className="px-4 py-2 rounded-lg font-medium transition-all"
                      style={{ 
                        backgroundColor: theme.interactive[variant].normal,
                        color: '#ffffff',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = theme.interactive[variant].hover;
                        if (isDark && variant === 'primary') {
                          e.target.style.boxShadow = themes.dark.glow.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = theme.interactive[variant].normal;
                        e.target.style.boxShadow = 'none';
                      }}
                      onMouseDown={(e) => {
                        e.target.style.backgroundColor = theme.interactive[variant].active;
                      }}
                      onMouseUp={(e) => {
                        e.target.style.backgroundColor = theme.interactive[variant].hover;
                      }}
                    >
                      {variant.charAt(0).toUpperCase() + variant.slice(1)}
                    </button>
                  ))}
                  <button
                    className="px-4 py-2 rounded-lg font-medium"
                    style={{ 
                      backgroundColor: theme.interactive.primary.disabled,
                      color: theme.content.disabled,
                      cursor: 'not-allowed',
                      opacity: 0.6
                    }}
                    disabled
                  >
                    Disabled
                  </button>
                </div>
              </div>
            </div>

            {/* Surface States */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Surface States (배경 상태)" 
                subtitle="리스트 아이템, 카드 등의 배경 상태"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['primary', 'secondary'].map(surface => (
                  <div key={surface} className="p-4 rounded-lg" style={{ backgroundColor: theme.layers.base.color }}>
                    <h3 className="text-sm font-semibold mb-4 capitalize" style={{ color: theme.content.secondary }}>
                      Surface {surface}
                    </h3>
                    <div className="space-y-2">
                      {['normal', 'hover', 'active', 'disabled'].map(state => (
                        <div 
                          key={state}
                          className="flex items-center gap-4 p-3 rounded-lg transition-all"
                          style={{ 
                            backgroundColor: theme.surface[surface][state],
                            border: `1px solid ${theme.border.default}`,
                            opacity: state === 'disabled' ? 0.5 : 1
                          }}
                        >
                          <StateBadge state={state} theme={theme} />
                          <span style={{ color: theme.content.primary }}>List Item</span>
                          <code 
                            className="text-xs ml-auto"
                            style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                          >
                            {theme.surface[surface][state]}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Interactive List Example */}
              <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: theme.surface.secondary.normal }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>
                  실제 리스트 예시 (Hover/Click 해보세요)
                </h3>
                <div className="space-y-2">
                  {['EQ-01-01', 'EQ-01-02', 'EQ-01-03'].map((id, i) => (
                    <div
                      key={id}
                      className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all"
                      style={{ 
                        backgroundColor: i === 1 ? theme.surface.primary.active : theme.surface.primary.normal,
                        border: `1px solid ${i === 1 ? theme.border.focus : theme.border.default}`
                      }}
                      onMouseEnter={(e) => {
                        if (i !== 1) e.target.style.backgroundColor = theme.surface.primary.hover;
                      }}
                      onMouseLeave={(e) => {
                        if (i !== 1) e.target.style.backgroundColor = theme.surface.primary.normal;
                      }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: theme.interactive.success.normal,
                          boxShadow: isDark ? themes.dark.glow.success : 'none'
                        }}
                      />
                      <span 
                        style={{ 
                          fontFamily: tokens.fonts.family.mono, 
                          color: theme.content.primary,
                          fontWeight: i === 1 ? 600 : 400
                        }}
                      >
                        {id}
                      </span>
                      <span style={{ color: theme.content.secondary }}>COATER_A{i + 1}</span>
                      {i === 1 && (
                        <span 
                          className="ml-auto text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: theme.interactive.primary.normal, color: '#fff' }}
                        >
                          Selected
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Disabled */}
                  <div
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ 
                      backgroundColor: theme.surface.primary.disabled,
                      border: `1px solid ${theme.border.subtle}`,
                      opacity: 0.5,
                      cursor: 'not-allowed'
                    }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.content.disabled }} />
                    <span style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.disabled }}>
                      EQ-01-04
                    </span>
                    <span style={{ color: theme.content.disabled }}>COATER_A4</span>
                    <span className="ml-auto text-xs" style={{ color: theme.content.disabled }}>Offline</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Input States */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Input States (입력 필드 상태)" 
                subtitle="Normal → Focus → Error → Disabled"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { state: 'Normal', border: theme.border.default, bg: theme.surface.secondary.normal },
                  { state: 'Focus', border: theme.border.focus, bg: theme.surface.secondary.normal, glow: true },
                  { state: 'Error', border: theme.interactive.danger.normal, bg: isDark ? 'rgba(248,113,113,0.1)' : '#fef2f2' },
                  { state: 'Disabled', border: theme.border.subtle, bg: theme.surface.secondary.disabled, disabled: true },
                ].map(input => (
                  <div key={input.state}>
                    <span className="text-xs font-medium block mb-2" style={{ color: theme.content.secondary }}>
                      {input.state}
                    </span>
                    <input
                      type="text"
                      placeholder="Enter value..."
                      disabled={input.disabled}
                      className="w-full px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        backgroundColor: input.bg,
                        border: `2px solid ${input.border}`,
                        color: input.disabled ? theme.content.disabled : theme.content.primary,
                        outline: 'none',
                        cursor: input.disabled ? 'not-allowed' : 'text',
                        boxShadow: input.glow && isDark ? `0 0 0 3px ${theme.border.focus}33` : 'none'
                      }}
                      defaultValue={input.state === 'Error' ? 'Invalid' : ''}
                    />
                    <code 
                      className="text-xs block mt-1"
                      style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.muted }}
                    >
                      border: {input.border}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ========================================
            TAB 5: Effects
            ======================================== */}
        {activeTab === 'effects' && (
          <section className="space-y-8">
            {/* Glassmorphism */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Glassmorphism (유리 효과)" 
                subtitle="3D 오버레이 패널에 적용되는 반투명 효과"
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Demo */}
                <div 
                  className="relative h-72 rounded-xl overflow-hidden"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.interactive.primary.normal} 0%, ${theme.interactive.success.normal} 50%, ${theme.interactive.danger.normal} 100%)`
                  }}
                >
                  <div className="absolute inset-0 opacity-30">
                    <div className="grid grid-cols-8 h-full">
                      {Array(16).fill(0).map((_, i) => (
                        <div key={i} className="border border-white/20" />
                      ))}
                    </div>
                  </div>
                  
                  <div 
                    className="absolute top-8 left-8 right-8 bottom-8 rounded-xl p-6"
                    style={{
                      backgroundColor: theme.glass.bg,
                      backdropFilter: `blur(${theme.glass.blur})`,
                      WebkitBackdropFilter: `blur(${theme.glass.blur})`,
                      border: `1px solid ${theme.glass.border}`,
                      boxShadow: theme.glass.shadow
                    }}
                  >
                    <h3 className="text-lg font-semibold mb-4" style={{ color: theme.content.primary }}>
                      Glass Panel
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span style={{ color: theme.content.secondary }}>Equipment</span>
                        <span style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.primary }}>EQ-01-05</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: theme.content.secondary }}>Temperature</span>
                        <span style={{ fontFamily: tokens.fonts.family.mono, color: theme.content.primary }}>125.4°C</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: theme.content.secondary }}>Status</span>
                        <span style={{ color: theme.interactive.success.normal, fontWeight: 500 }}>Running</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Properties */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold" style={{ color: theme.content.secondary }}>CSS Properties</h3>
                  
                  {[
                    { prop: 'background', value: theme.glass.bg, desc: '반투명 배경' },
                    { prop: 'backdrop-filter', value: `blur(${theme.glass.blur})`, desc: '뒤 콘텐츠 블러' },
                    { prop: 'border', value: `1px solid ${theme.glass.border}`, desc: '미세한 테두리' },
                    { prop: 'box-shadow', value: theme.glass.shadow, desc: '부드러운 그림자' },
                  ].map(item => (
                    <div 
                      key={item.prop}
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: theme.surface.secondary.normal }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <code 
                          className="text-sm font-semibold"
                          style={{ color: theme.interactive.primary.normal }}
                        >
                          {item.prop}
                        </code>
                        <span className="text-xs" style={{ color: theme.content.muted }}>— {item.desc}</span>
                      </div>
                      <code 
                        className="text-xs block p-2 rounded"
                        style={{ 
                          fontFamily: tokens.fonts.family.mono,
                          backgroundColor: theme.layers.base.color,
                          color: theme.content.tertiary
                        }}
                      >
                        {item.value}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Shadows */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Shadow Scale (그림자)" 
                subtitle="깊이감 표현을 위한 그림자 스케일"
                theme={theme}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { name: 'sm', value: '0 1px 2px rgba(0,0,0,0.05)', desc: '미세한' },
                  { name: 'md', value: '0 4px 6px -1px rgba(0,0,0,0.1)', desc: '기본' },
                  { name: 'lg', value: '0 10px 15px -3px rgba(0,0,0,0.1)', desc: '강조' },
                  { name: 'xl', value: '0 20px 25px -5px rgba(0,0,0,0.1)', desc: '최대' },
                ].map(shadow => (
                  <div key={shadow.name} className="text-center">
                    <div 
                      className="h-24 rounded-xl flex items-center justify-center mb-3 transition-all"
                      style={{ 
                        backgroundColor: theme.layers.panel.color,
                        boxShadow: shadow.value
                      }}
                    >
                      <code 
                        className="text-sm font-semibold"
                        style={{ color: theme.content.secondary }}
                      >
                        shadow-{shadow.name}
                      </code>
                    </div>
                    <span className="text-xs" style={{ color: theme.content.muted }}>{shadow.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Glow Effects */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Glow Effects (발광 효과)" 
                subtitle={isDark ? "Dark Mode에서 활성화되는 Cybernetic 효과" : "⚠️ Light Mode에서는 비활성화됨 (Dark Mode로 전환해보세요)"}
                theme={theme}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: 'Primary', color: '#06b6d4', glow: '0 0 20px rgba(6, 182, 212, 0.4)' },
                  { name: 'Success', color: '#4ade80', glow: '0 0 12px rgba(74, 222, 128, 0.5)' },
                  { name: 'Error', color: '#f87171', glow: '0 0 12px rgba(248, 113, 113, 0.5)' },
                ].map(item => (
                  <div 
                    key={item.name}
                    className="p-6 rounded-xl text-center"
                    style={{ backgroundColor: theme.layers.base.color }}
                  >
                    <div 
                      className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-300"
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: isDark ? item.glow : 'none',
                      }}
                    >
                      <span className="text-white text-2xl">●</span>
                    </div>
                    <h4 className="font-semibold mb-2" style={{ color: theme.content.primary }}>{item.name}</h4>
                    <code 
                      className="text-xs block p-2 rounded"
                      style={{ 
                        fontFamily: tokens.fonts.family.mono,
                        backgroundColor: theme.surface.secondary.normal,
                        color: isDark ? item.color : theme.content.muted
                      }}
                    >
                      {isDark ? item.glow : 'none (Light Mode)'}
                    </code>
                  </div>
                ))}
              </div>

              {!isDark && (
                <div 
                  className="mt-4 p-4 rounded-lg text-center"
                  style={{ backgroundColor: theme.surface.secondary.normal }}
                >
                  <p className="text-sm" style={{ color: theme.content.secondary }}>
                    🌙 Dark Mode로 전환하면 Glow 효과가 활성화됩니다
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================
            TAB 6: Panel Composition Example
            ======================================== */}
        {activeTab === 'panel' && (
          <section className="space-y-8">
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title="Equipment Info Panel 조합 예시" 
                subtitle="실제 컴포넌트가 어떻게 조합되는지 분석"
                theme={theme}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Actual Panel */}
                <div>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>실제 렌더링</h3>
                  
                  <div 
                    className="rounded-xl overflow-hidden"
                    style={{ 
                      backgroundColor: theme.glass.bg,
                      backdropFilter: `blur(${theme.glass.blur})`,
                      border: `1px solid ${theme.glass.border}`,
                      boxShadow: theme.glass.shadow
                    }}
                  >
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between p-4"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : theme.layers.base.color,
                        borderBottom: `1px solid ${theme.border.default}`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <h2 style={{ 
                          fontSize: '18px', 
                          fontWeight: 600, 
                          color: theme.interactive.primary.normal, 
                          margin: 0,
                          fontFamily: tokens.fonts.family.base
                        }}>
                          Equipment Info
                        </h2>
                        <div 
                          className="flex items-center gap-2 px-3 py-1 rounded-full"
                          style={{ backgroundColor: isDark ? 'rgba(74,222,128,0.15)' : '#dcfce7' }}
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ 
                              backgroundColor: theme.interactive.success.normal,
                              boxShadow: isDark ? themes.dark.glow.success : 'none'
                            }}
                          />
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: 500, 
                            color: theme.interactive.success.normal 
                          }}>
                            Running
                          </span>
                        </div>
                      </div>
                      <button 
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{ 
                          backgroundColor: theme.interactive.danger.normal,
                          color: '#fff',
                          fontSize: '16px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = theme.interactive.danger.hover}
                        onMouseLeave={(e) => e.target.style.backgroundColor = theme.interactive.danger.normal}
                      >
                        ×
                      </button>
                    </div>

                    {/* Tabs */}
                    <div 
                      className="flex gap-1 px-3"
                      style={{ borderBottom: `1px solid ${theme.border.default}` }}
                    >
                      {['General', 'PC Info', 'History'].map((tab, i) => (
                        <button 
                          key={tab}
                          className="px-4 py-2 transition-all"
                          style={{ 
                            fontSize: '12px',
                            fontWeight: i === 0 ? 600 : 500,
                            color: i === 0 ? theme.interactive.primary.normal : theme.content.secondary,
                            borderBottom: `2px solid ${i === 0 ? theme.interactive.primary.normal : 'transparent'}`,
                            background: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      {[
                        { label: 'Equipment ID', value: 'EQ-01-05', mono: true },
                        { label: 'Machine Name', value: 'COATER_A1', mono: true },
                        { label: 'Status', value: 'Running', mono: false, status: 'success' },
                        { label: 'Lot ID', value: 'LOT2024011234', mono: true },
                        { label: 'Temperature', value: '125.45°C', mono: true },
                        { label: 'Pressure', value: '1.234 bar', mono: true },
                      ].map(row => (
                        <div 
                          key={row.label}
                          className="flex items-center p-3 rounded-lg transition-all"
                          style={{ backgroundColor: isDark ? theme.layers.panel.color : theme.layers.base.color }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = theme.surface.primary.hover}
                          onMouseLeave={(e) => e.target.style.backgroundColor = isDark ? theme.layers.panel.color : theme.layers.base.color}
                        >
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: 600, 
                            color: theme.content.secondary, 
                            minWidth: '100px' 
                          }}>
                            {row.label}
                          </span>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: 500, 
                            color: row.status ? theme.interactive.success.normal : theme.content.primary,
                            fontFamily: row.mono ? tokens.fonts.family.mono : tokens.fonts.family.base
                          }}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: theme.content.secondary }}>구성 요소 분석</h3>
                  
                  <div className="space-y-3">
                    {[
                      { 
                        name: '.equipment-panel', 
                        color: theme.interactive.primary.normal,
                        props: [
                          `background: ${theme.glass.bg}`,
                          `backdrop-filter: blur(${theme.glass.blur})`,
                          `border: 1px solid ${theme.glass.border}`,
                          'border-radius: 12px'
                        ]
                      },
                      { 
                        name: '.equipment-panel__header', 
                        color: theme.interactive.success.normal,
                        props: [
                          `background: ${isDark ? 'rgba(0,0,0,0.3)' : theme.layers.base.color}`,
                          'display: flex (u-flex)',
                          'padding: 16px (u-p-4)'
                        ]
                      },
                      { 
                        name: '.equipment-panel__title', 
                        color: '#f97316',
                        props: [
                          `color: ${theme.interactive.primary.normal}`,
                          'font-size: 18px (u-text-lg)',
                          'font-weight: 600 (u-font-semibold)',
                          "font-family: 'Inter'"
                        ]
                      },
                      { 
                        name: '.equipment-panel__info-row', 
                        color: '#a855f7',
                        props: [
                          `background: ${isDark ? theme.layers.panel.color : theme.layers.base.color}`,
                          'padding: 12px (u-p-3)',
                          'border-radius: 8px',
                          `hover: ${theme.surface.primary.hover}`
                        ]
                      },
                      { 
                        name: '.equipment-panel__info-value', 
                        color: '#ec4899',
                        props: [
                          `color: ${theme.content.primary}`,
                          'font-size: 14px (u-text-base)',
                          "font-family: 'JetBrains Mono' (for IDs/Data)"
                        ]
                      },
                    ].map(item => (
                      <div 
                        key={item.name}
                        className="p-3 rounded-lg"
                        style={{ 
                          backgroundColor: theme.surface.secondary.normal,
                          borderLeft: `4px solid ${item.color}`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <code 
                            className="text-sm font-semibold"
                            style={{ color: item.color }}
                          >
                            {item.name}
                          </code>
                        </div>
                        <div className="space-y-1">
                          {item.props.map((prop, i) => (
                            <code 
                              key={i}
                              className="text-xs block"
                              style={{ 
                                fontFamily: tokens.fonts.family.mono,
                                color: theme.content.muted
                              }}
                            >
                              • {prop}
                            </code>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Code Examples */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: theme.content.secondary }}>
                    HTML (BEM + Utility Classes)
                  </h4>
                  <pre 
                    className="p-4 rounded-lg text-xs overflow-x-auto"
                    style={{ 
                      backgroundColor: '#1e293b', 
                      color: '#e2e8f0',
                      fontFamily: tokens.fonts.family.mono
                    }}
                  >
{`<div class="equipment-panel equipment-panel--active">
  <header class="equipment-panel__header 
                 u-flex u-justify-between u-items-center u-p-4">
    <h2 class="equipment-panel__title 
               u-text-lg u-font-semibold">
      Equipment Info
    </h2>
    <div class="equipment-panel__status">
      <span class="equipment-panel__status-dot 
                   equipment-panel__status-dot--running">
      </span>
      <span class="equipment-panel__status-text">Running</span>
    </div>
  </header>
  
  <div class="equipment-panel__content u-p-4">
    <div class="equipment-panel__info-row u-flex u-p-3 u-mb-2">
      <span class="equipment-panel__info-label">ID</span>
      <span class="equipment-panel__info-value 
                   equipment-panel__info-value--mono">
        EQ-01-05
      </span>
    </div>
  </div>
</div>`}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: theme.content.secondary }}>
                    CSS (Design Token 기반)
                  </h4>
                  <pre 
                    className="p-4 rounded-lg text-xs overflow-x-auto"
                    style={{ 
                      backgroundColor: '#1e293b', 
                      color: '#e2e8f0',
                      fontFamily: tokens.fonts.family.mono
                    }}
                  >
{`.equipment-panel {
  background: var(--surface-glass);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
}

.equipment-panel__title {
  color: var(--interactive-primary);
  font-family: var(--font-family-base);
}

.equipment-panel__info-value--mono {
  font-family: var(--font-family-mono);
  color: var(--content-primary);
}

.equipment-panel__status-dot--running {
  background: var(--status-running);
  box-shadow: var(--glow-success); /* Dark only */
}

.equipment-panel__info-row:hover {
  background: var(--surface-hover);
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Quick Reference */}
            <div className="p-6 rounded-xl" style={{ backgroundColor: theme.layers.panel.color, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <SectionHeader 
                title={`Quick Reference (${theme.name})`}
                subtitle="자주 사용하는 값 요약"
                theme={theme}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'App BG', value: theme.layers.base.color },
                  { label: 'Panel BG', value: theme.layers.panel.color },
                  { label: 'Glass BG', value: theme.glass.bg },
                  { label: 'Text Primary', value: theme.content.primary },
                  { label: 'Text Secondary', value: theme.content.secondary },
                  { label: 'Border', value: theme.border.default },
                  { label: 'Primary', value: theme.interactive.primary.normal },
                  { label: 'Success', value: theme.interactive.success.normal },
                ].map(item => (
                  <div 
                    key={item.label}
                    className="p-3 rounded-lg flex items-center gap-3"
                    style={{ backgroundColor: theme.surface.secondary.normal }}
                  >
                    <div 
                      className="w-10 h-10 rounded flex-shrink-0"
                      style={{ 
                        backgroundColor: item.value,
                        border: `1px solid ${theme.border.default}`
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: theme.content.secondary }}>
                        {item.label}
                      </div>
                      <code 
                        className="text-xs truncate block"
                        style={{ 
                          fontFamily: tokens.fonts.family.mono,
                          color: theme.content.muted 
                        }}
                      >
                        {item.value.length > 25 ? item.value.substring(0, 22) + '...' : item.value}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer 
        className="mt-12 p-6 text-center"
        style={{ 
          backgroundColor: theme.layers.panel.color,
          borderTop: `1px solid ${theme.border.default}`
        }}
      >
        <p className="text-sm" style={{ color: theme.content.muted }}>
          SHERLOCK_SKY Design System v2.0 | {theme.name} | 
          <span style={{ fontFamily: tokens.fonts.family.mono }}> Inter + JetBrains Mono</span>
        </p>
      </footer>
    </div>
  );
}