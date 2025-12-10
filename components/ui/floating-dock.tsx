"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface DockItem {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

interface FloatingDockProps {
  items: DockItem[];
  mobileClassName?: string;
}

export function FloatingDock({ items, mobileClassName }: FloatingDockProps) {
  // Center the dock in the map area (from left edge to left edge of itinerary panel)
  // Map area is calc(100% - 320px), so center is at calc((100% - 320px) / 2)
  return (
    <div className="fixed bottom-8 z-50" style={{ left: 'calc((100% - 320px) / 2)', transform: 'translateX(-50%)' }}>
      <Dock items={items} />
    </div>
  );
}

function Dock({ items }: { items: DockItem[] }) {
  return (
    <div
      className="flex items-end gap-2 px-4 py-3 rounded-2xl backdrop-blur-lg border transition-all duration-300"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {items.map((item, idx) => (
        <DockItem
          key={item.title}
          item={item}
          index={idx}
        />
      ))}
    </div>
  );
}

function DockItem({
  item,
  index,
}: {
  item: DockItem;
  index: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 700 };
  const x = useSpring(useTransform(mouseX, [-150, 0, 150], [-45, 0, 45]), springConfig);
  const rotate = useSpring(useTransform(mouseX, [-150, 0, 150], [-25, 0, 25]), springConfig);
  const scale = useSpring(useTransform(mouseX, [-150, 0, 150], [0.8, 1, 0.8]), springConfig);
  const opacity = useSpring(useTransform(mouseX, [-150, 0, 150], [0.6, 1, 0.6]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    mouseX.set(e.clientX - centerX);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleClick = () => {
    if (item.onClick) {
      item.onClick();
    }
    if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <motion.button
      ref={ref}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        x,
        rotate,
        scale,
        opacity,
        backgroundColor: isHovered ? 'var(--accent)' : 'transparent',
        color: 'var(--foreground)',
      }}
      className="relative flex items-center justify-center w-12 h-12 rounded-full transition-colors"
    >
      <div className="flex items-center justify-center w-full h-full">
        {item.icon}
      </div>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10, x: "-50%" }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-12 left-1/2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {item.title}
        </motion.div>
      )}
    </motion.button>
  );
}

